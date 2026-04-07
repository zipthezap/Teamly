import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens the given [address] in Google Maps.
/// Shows a [SnackBar] error on [context] if Maps cannot be launched.
Future<void> openInMaps(BuildContext context, String address) async {
  final encoded = Uri.encodeComponent(address);
  final uri =
      Uri.parse('https://www.google.com/maps/search/?api=1&query=$encoded');
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open Maps')),
    );
  }
}
