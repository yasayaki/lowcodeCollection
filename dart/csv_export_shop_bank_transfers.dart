// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/backend/schema/enums/enums.dart';
import '/actions/actions.dart' as action_blocks;
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom action code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'package:csv/csv.dart';
import 'package:file_saver/file_saver.dart';
import 'dart:convert';

Future csvExportShopBankTransfers(List<ShopBankTransfersRecord>? shops) async {
  // Create a list for CSV rows
  List<List<String>> csvData = [];

  // CSV header row
  csvData.add(['店舗名', '振込額', '決済手数料']);

  shops?.forEach((shop) {
    csvData.add([
      shop.shopName,
      shop.transferAmount.toString(),
      shop.fee.toString(),
    ]);
  });

  // CSVデータを文字列形式に変換
  String csv = const ListToCsvConverter().convert(csvData);

  // CSVデータをUint8Listに変換
  Uint8List bytes = Uint8List.fromList(utf8.encode(csv));

  // ファイルを保存
  await FileSaver.instance.saveFile(
    name: 'user_data', // ファイル名 (required)
    bytes: bytes, // ファイルの内容 (required)
    ext: 'csv', // 拡張子 (required)
    mimeType: MimeType.text, // MIMEタイプ (適切なMimeTypeを使用)
  );
}
