const functions = require("firebase-functions");
const admin = require("firebase-admin");
// To avoid deployment errors, do not call admin.initializeApp() in your code

exports.onRequestPaymentAccounttransferCallback = functions
  .region("asia-northeast1")
  .https.onRequest(async (request, response) => {
    const { cid, regst, cod } = request.query;

    if (regst === "2") {
      try {
        const db = admin.firestore();
        const userRef = db.collection("users").doc(cod);
        const transactions = db.collection("transactions").doc();
        // 初期の利用可能金額を取得
        const systemConfig = await db
          .collection("system_config")
          .doc("system_config")
          .get();
        const cash_payment_min = systemConfig.data().cash_payment_min;

        const batch = db.batch();

        // ユーザードキュメントを更新
        batch.update(userRef, {
          bank_approved_time: admin.firestore.Timestamp.now(),
          limit_amount: cash_payment_min,
          subscpay_id: String(cid),
        });

        // transactionで初期の利用可能金額を付与。user_amountへはonWriteTransactionsで反映される。
        batch.set(transactions, {
          user_ref: userRef,
          transaction_credit: cash_payment_min,
          action: "charge_amount_auto",
          created_time: admin.firestore.Timestamp.now(),
        });

        await batch.commit();
      } catch (error) {
        console.error("Error updating user document:", error);
        // エラー発生時の適切な処理を追加
      }
    } else {
      console.log("error");
    }
    response.redirect("");
  });
