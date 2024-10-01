const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.onScheduleTransfer = functions.region('asia-northeast1').pubsub
  .schedule('0 0 1 * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {

    const db = admin.firestore();
  
    // 締め日を作成
    const transactionDate = new Date();
    transactionDate.setDate(0);
    transactionDate.setHours(23, 59, 59, 999);
    const transactionTimestamp = admin.firestore.Timestamp.fromDate(transactionDate);
    
    // 取引タイプが'支払い' & 今月請求分のものだけ取得
    const invoiceStartDate = new Date();
    invoiceStartDate.setMonth(invoiceStartDate.getMonth() - 1, 1);
    invoiceStartDate.setHours(0, 0, 0, 0);
    const invoiceEndDate = new Date();
    invoiceEndDate.setDate(1);
    invoiceEndDate.setHours(0, 0, 0, 0);
    const targetTransactions = db.collection('transactions')
      .where('action', '==', 'pay')
      .where('status', '==', 'fixed')
      .where('created_time', '>=', invoiceStartDate)
      .where('created_time', '<', invoiceEndDate);
  
    // 承認済みの店舗を取得
    let shops = await db.collection('shops').where('shop_status', '==','using').get();
  
    // 対象期間の取引を取得
    const targetTransactionsSnapshot = await targetTransactions.get();
  
    // targetTransactionsのshop_refに含まれる店舗のみをフィルタリング
    let filteredShops = shops.docs.filter((shopDoc) => {
      return targetTransactionsSnapshot.docs.some((transactionDoc) => {
        const transactionShopRef = transactionDoc.data().shop_ref; // トランザクション内のshop_refを取得
        return transactionShopRef && transactionShopRef.isEqual(shopDoc.ref); // shop_refとshopDoc.refが一致するかを確認
      });
    });
  
    // shopへの振込作成
    for (const shop of filteredShops) {
  
      const shop_bank_transfers = db.collection('shops').doc(shop.id).collection('shop_bank_transfers');
      
      // 重複しないように、最後のshop_bank_transfersを取得してチェック
      const lastTransfer = await db.collectionGroup('shop_bank_transfers')
        .where('shop_ref', '==', shop.ref)
        .orderBy('created_time', 'desc')
        .limit(1)
        .get();
  
      if (lastTransfer.docs.length) {
        const lastDate = lastTransfer.docs[0].data().created_time.toDate();
        // すでに同じ月に処理している場合はスキップ
        if (transactionDate.getMonth() === lastDate.getMonth()) {
          continue;
        }
      }
  
      // batchは最大500件の制限があるため1人ずつコミットする
      const batch = db.batch();
  
      // 決済金額を集計
      const transactionOriginalAmount = await targetTransactions
        .where('shop_ref', '==', shop.ref)
        .aggregate({ totalPopulation: admin.firestore.AggregateField.sum('original_amount') })
        .get()
        .then((doc) => doc.data().totalPopulation);
      // 決済手数料を集計
      const transactionFee = await targetTransactions
        .where('shop_ref', '==', shop.ref)
        .aggregate({ totalPopulation: admin.firestore.AggregateField.sum('fee') })
        .get()
        .then((doc) => doc.data().totalPopulation);
  
      batch.set(shop_bank_transfers.doc(), {
        shop_ref: shop.ref,
        shop_name: shop.data().shop_name,
        amount: transactionOriginalAmount,
        fee: transactionFee,
        transfer_amount: transactionOriginalAmount - transactionFee,
        bank_processing_status: 'transfer_request',
        created_time: transactionTimestamp,
        created_month_string: `${transactionDate.getFullYear()}/${transactionDate.getMonth() + 1}`,
      });
  
      await batch.commit();
    }
  });