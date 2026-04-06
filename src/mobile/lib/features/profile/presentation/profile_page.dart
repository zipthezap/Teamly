import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/user_avatar.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.user;
    final theme = Theme.of(context);

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Avatar + name
          Center(
            child: Column(
              children: [
                UserAvatar(
                  name: user.name,
                  imageUrl: user.profilePicture,
                  radius: 42,
                ),
                const SizedBox(height: 12),
                Text(user.name, style: theme.textTheme.titleLarge),
                Text(user.email, style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
                if (!user.emailVerified)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Chip(
                      label: Text('Email not verified'),
                      backgroundColor: Colors.orange,
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Divider(),

          // Location info
          if (user.city != null || user.country != null)
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text([user.city, user.country].whereType<String>().join(', ')),
              subtitle: const Text('Location'),
            ),

          // Account actions
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign out', style: TextStyle(color: Colors.red)),
            onTap: () async {
              await ref.read(authNotifierProvider.notifier).logout();
              if (context.mounted) context.go('/auth');
            },
          ),
        ],
      ),
    );
  }
}
