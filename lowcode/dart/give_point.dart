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

import 'dart:convert';
import 'package:csv/csv.dart';
import '/auth/firebase_auth/auth_util.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

Future<List<dynamic>> givePoint(FFUploadedFile csvFile, String type) async {
  if (!_isCSVFile(csvFile)) {
    return [
      {
        'status': 'error',
        'message': 'CSVファイルではありません。',
      }
    ];
  }

  try {
    final csvContent = utf8.decode(csvFile.bytes!);
    List<List<dynamic>> records = const CsvToListConverter().convert(
      csvContent,
      eol: '\n',
      shouldParseNumbers: true,
      allowInvalid: false,
    );

    final List<dynamic> header = records.first;
    records = records.sublist(1);

    List<dynamic> results = [];
    List<int> errorRecords = [];
    int count = 1;
    final firestore = FirebaseFirestore.instance;

    // userを取得
    final usersSnapshot = await firestore.collection('users').get();
    List<String> usersRef = [];
    usersSnapshot.docs.forEach((doc) {
      usersRef.add(doc.reference.id);
    });

    if (type == 'gyokuPoint') {
      for (final record in records) {
        // データが正しくないレコードは除外
        if (record.length != header.length ||
            int.tryParse(record[1].toString()) == null ||
            usersRef.contains(record[0]) != true) {
          errorRecords.add(count);
        } else {
          results.add({
            'user_id': record[0],
            'gyoku_point': record[1],
          });
        }
        count++;
      }
    }

    if (type == 'areaPoint') {
      // 地域ポイントを取得
      final areaPointsSnapshot =
          await firestore.collection('area_points').get();
      List<String> areaPointsRef = [];
      areaPointsSnapshot.docs.forEach((doc) {
        areaPointsRef.add(doc.reference.id);
      });

      for (final record in records) {
        // データが正しくないレコードは除外
        if (record.length != header.length ||
            areaPointsRef.contains(record[1]) != true ||
            int.tryParse(record[2].toString()) == null ||
            usersRef.contains(record[0]) != true) {
          errorRecords.add(count);
        } else {
          results.add({
            'user_id': record[0],
            'area_point_id': record[1],
            'area_point': record[2],
          });
        }
        count++;
      }
    }

    if (errorRecords.isNotEmpty) {
      return [
        {
          'status': 'error',
          'message': '${errorRecords.join(", ")}行目が正しくありません。',
        }
      ];
    } else {
      return results;
    }
  } on FormatException catch (e) {
    return [
      {
        'status': 'error',
        'message': 'CSVのフォーマットエラー: ${e.message}',
      }
    ];
  } catch (e) {
    return [
      {
        'status': 'error',
        'message': 'エラーが発生しました: ${e.toString()}',
      }
    ];
  }
}

bool _isCSVFile(FFUploadedFile file) {
  final String extension = file.name!.split('.').last;
  return extension.toLowerCase() == 'csv';
}
