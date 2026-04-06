import 'package:flutter/material.dart';

class FeaturePlaceholder extends StatelessWidget {
  const FeaturePlaceholder({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            subtitle,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
