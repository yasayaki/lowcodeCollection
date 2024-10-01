const functions = require('firebase-functions');
const admin = require('firebase-admin');
// To avoid deployment errors, do not call admin.initializeApp() in your code

exports.createShop = functions.region('asia-northeast1').https.onCall(
  async (data, context) => {

    // const password = data.password;
    const email = data.email;
    const password = data.password;
    const shopName = data.shopName;
    const phone = data.phone;
    const type = data.type;
    const address = data.address;
    const latlngJosn = data.latlng;

    const db = admin.firestore();
    const auth = admin.auth();
    const batch = db.batch();
    const Timestamp = admin.firestore.Timestamp;
    const users = db.collection('users');

    // 重複チェック
    // const existUser = await users.where('email', '==', email).get();
    // if (existUser.docs.length) {
    //   throw new functions.https.HttpsError('already-exists', 'Already existing email.');
    // }

    // Authentication作成
    const authUser = await auth.createUser({
      email: email,
      password: password,
    });

    try {
      // users, shopsを作成
      const shops = db.collection('shops');
      const shopDoc = shops.doc();
      const userDoc = users.doc(authUser.uid);
      const createdTime = Timestamp.now();
      const latlng = new admin.firestore.GeoPoint(latlngJosn['lat'], latlngJosn['lng']);
      
      batch.set(shopDoc, {
        shop_name: shopName,
        phone_number: phone,
        type: type,
        address: address,
        latlng: latlng,
        shop_status: 'using',
        user_ref: userDoc,
        created_time: createdTime,
      });


      batch.set(userDoc, {
        uid: authUser.uid,
        email: email,
        created_time: createdTime,
        role: 'shop',
        shop_ref: shopDoc,
      });
      

      await batch.commit();

      return {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
      };

    } catch (err) {
      console.error('Error creating user:', err);
      await auth.deleteUser(authUser.uid);

      throw new functions.https.HttpsError('internal', 'Error creating user', err);
    }
  }
);