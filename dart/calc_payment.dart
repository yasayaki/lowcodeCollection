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

Future<PaymentStruct> calcPayment(
  int amount,
  int? hasCurrency,
  int? hasPoint,
  double discountRate,
  int availableAmount,
  String shopType,
) async {
  int currency =
      hasCurrency == null ? 0 : (amount < hasCurrency ? amount : hasCurrency);
  int remaining_amount = amount - currency;

  int point = hasPoint == null
      ? 0
      : (remaining_amount < hasPoint ? remaining_amount : hasPoint);
  remaining_amount -= point;

  int discount = (remaining_amount * discountRate).floor();
  remaining_amount -= discount;

  int credit = remaining_amount;

  // calc TransactionFee
  int taxable_boundary = 80000;
  int taxable_amount;
  double fee_rate;
  int fee;

  if (shopType == 'insuranceMedicalTreatment') {
    taxable_amount = amount <= taxable_boundary ? 0 : amount - taxable_boundary;
    fee_rate = 0.0125;
    fee = (taxable_amount * fee_rate).ceil();
  } else if (shopType == 'freeMedicalTreatment') {
    taxable_amount = amount;
    fee_rate = 0.0125;
    fee = (taxable_amount * fee_rate).ceil();
  } else {
    taxable_amount = amount;
    fee_rate = 0.0148;
    fee = (taxable_amount * fee_rate).ceil();
  }

  return PaymentStruct(
    areaPoint: currency,
    gyokuPoint: point,
    credit: credit,
    discount: discount,
    amount: amount - discount,
    originalAmount: amount,
    availableAmount: availableAmount - credit,
    taxableAmount: taxable_amount,
    feeRate: fee_rate,
    fee: fee,
  );
}
