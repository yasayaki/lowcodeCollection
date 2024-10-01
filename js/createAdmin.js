const functions = require('firebase-functions');
const admin = require('firebase-admin');
// To avoid deployment errors, do not call admin.initializeApp() in your code

exports.createAdmin = functions.region('asia-northeast1').https.onCall(
  async (data, context) => {

    // const password = data.password;
    const email = data.email;
    const password = data.password;
    const username = data.name;
    const role = data.role;

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
      displayName: username,
    });

    try {
      const userDoc = users.doc(authUser.uid);
      const createdTime = Timestamp.now();

      // users, accountsを作成
      batch.set(userDoc, {
        uid: authUser.uid,
        email: email,
        display_name: username,
        created_time: createdTime,
        role: role,
        Authority: {
          develop: true,
          create_account: true,
          edit_account: true,
          list_account: true,
          post_announcement: true,
        },
      });

      await batch.commit();

      return true;

    } catch (err) {
      console.error('Error creating user:', err);
      await auth.deleteUser(authUser.uid);
      throw new functions.https.HttpsError('internal', 'Error creating user', err);
    }
  }
);