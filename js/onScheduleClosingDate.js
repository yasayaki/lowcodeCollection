const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * 毎月16日0:00の処理
 * ・user >> user_bank_processingの作成
 * 
 * ・全ユーザーの利用可能金額の増加
 * 初月3000円付与。上限cash_payment_max。
 * 今月請求分（前月16日〜当月15日）の利用金額が500円以上で、翌月の利用可能金額が500円増加。
 * ただし↑が適用されるのは2ヶ月目以降。（2ヶ月目の利用金額が500円以上で、3ヶ月目が3500円になる。）
 * 
 * 請求金額からuser >> invoice_moneyを引く
 */
exports.onScheduleClosingDate = functions.region('asia-northeast1').pubsub
  .schedule('0 0 16 * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {

  const db = admin.firestore();
  const collTransactions = db.collection('transactions');
  
  // 締め日を作成
  const transactionDate = new Date();
  transactionDate.setDate(15);
  transactionDate.setHours(23, 59, 59, 999);
  const transactionTimestamp = admin.firestore.Timestamp.fromDate(transactionDate);

  // 今月分の開始日
  const invoiceStartDate = new Date();
  invoiceStartDate.setDate(16);
  invoiceStartDate.setHours(0, 0, 0, 0);

  // 利用可能上限金額を取得
  const systemConfig = await db.collection('system_config').doc('system_config').get();
  const cash_payment_max = systemConfig.data().cash_payment_max;

  // 口座登録が完了しているユーザーを取得し、請求があるユーザーのみに絞り込み
  let users = await db.collection('users').where('bank_approved_time', '!=', null).get();
  users = users.docs.filter((user) => user.data().user_amount < user.data().limit_amount);

  // userへの請求作成
  for (const user of users) {

    const user_bank_processing = db.collection('users').doc(user.id).collection('user_bank_processing');

    // 重複しないように、最後のuser_bank_processingを取得してチェック
    const lastInvoice = await db.collectionGroup('user_bank_processing')
      .where('user_ref', '==', user.ref)
      .orderBy('created_time', 'desc')
      .limit(1)
      .get();

    if (lastInvoice.docs.length) {
      const lastDate = lastInvoice.docs[0].data().created_time.toDate();
      // すでに同じ月に処理している場合はスキップ
      if (transactionDate.getMonth() === lastDate.getMonth()) {
        continue;
      }
    }

    // batchは最大500件の制限があるため1人ずつコミットする
    const batch = db.batch();
    const user_amount = user.data().user_amount;
    let limit_amount = user.data().limit_amount;
    const used_amount = limit_amount - user_amount;
    const invoice_money = user.data().invoice_money ?? 0;
    let startDateOfUse = user.data().bank_approved_time.toDate();

    // 請求があるuserのみ請求作成
    if (used_amount > invoice_money) {
      batch.set(user_bank_processing.doc(), {
        user_ref: user.ref,
        user_name: user.data().real_name,
        subscpay_id: user.data().subscpay_id,
        amount: used_amount - invoice_money,
        bank_processing_status: 'transfer_request',
        bank_processing_type: 'billing',
        created_time: transactionTimestamp,
        created_month_string: `${transactionDate.getFullYear()}/${transactionDate.getMonth() + 1}`,
      });
    }

    if (startDateOfUse.getDate() >= 16) {
      startDateOfUse.setMonth(startDateOfUse.getMonth() + 1);
    }

    // 登録からの経過月を算出
    const passedMonth = invoiceStartDate.getMonth() - startDateOfUse.getMonth();
    // 利用可能金額の増加処理（利用金額が500円以上の場合。上限cash_payment_maxまで。2ヶ月目から適用。）
    if (used_amount >= 500 && limit_amount < cash_payment_max && passedMonth >= 1) {
      limit_amount += 500;
    }

    // invoice_moneyを所持している or　limit_amountが増えるユーザーのみ
    // user_amountはonWriteTransaction.jsで自動更新
    if (invoice_money > 0 || limit_amount > user.data().limit_amount) {
      batch.update(user.ref, {
        invoice_money: used_amount - invoice_money >= 0 ? 0 : Math.abs(used_amount - invoice_money),
        limit_amount: limit_amount,
      })
    }

    // 利用可能金額の増加処理(limit_amount < user_amountにならないように、user更新の後に実行)
    batch.set(collTransactions.doc(), {
      user_ref: user.ref,
      transaction_credit: limit_amount - user_amount,
      action: 'charge_amount_auto',
      created_time: invoiceStartDate,
    });
    
    await batch.commit();
  }

  });