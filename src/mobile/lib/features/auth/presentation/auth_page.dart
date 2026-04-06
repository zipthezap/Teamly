import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';


class AuthPage extends StatelessWidget {
  const AuthPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Authentication')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'MVP auth flow scaffolded. Implement login/register UI against /auth endpoints.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/dashboard'),
              child: const Text('Continue to Dashboard Shell'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go('/groups'),
              child: const Text('Groups Shell'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go('/events'),
              child: const Text('Events Shell'),
            ),
          ],
        ),
      ),
    );
  }
}
