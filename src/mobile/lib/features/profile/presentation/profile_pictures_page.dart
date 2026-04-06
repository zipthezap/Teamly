import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/api_client.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/user_avatar.dart';

final _profilePicturesProvider =
    FutureProvider<List<ProfilePictureModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response =
      await dio.get<Map<String, dynamic>>('/auth/profile/pictures');
  final items = response.data?['pictures'] as List<dynamic>?
      ?? response.data?['data'] as List<dynamic>?
      ?? [];
  return items
      .map((e) => ProfilePictureModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

class ProfilePicturesPage extends ConsumerWidget {
  const ProfilePicturesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final picturesAsync = ref.watch(_profilePicturesProvider);
    final currentUser = ref.watch(authNotifierProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile Pictures'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_profilePicturesProvider),
          ),
        ],
      ),
      body: picturesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(_profilePicturesProvider),
        ),
        data: (pictures) {
          if (pictures.isEmpty) {
            return const Center(
              child: Text('No picture history available.',
                  style: TextStyle(color: Colors.grey)),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
            ),
            itemCount: pictures.length,
            itemBuilder: (ctx, i) {
              final pic = pictures[i];
              final isCurrent = pic.isCurrent == true ||
                  pic.url == currentUser?.profilePicture;
              return GestureDetector(
                onTap: () => _showPictureOptions(ctx, ref, pic, isCurrent),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        pic.url,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: Theme.of(ctx).colorScheme.surfaceContainerHighest,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
                    ),
                    if (isCurrent)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('Current',
                              style: TextStyle(
                                  color: Colors.white, fontSize: 10)),
                        ),
                      ),
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Colors.black54],
                          ),
                          borderRadius: BorderRadius.vertical(
                              bottom: Radius.circular(8)),
                        ),
                        child: Text(
                          DateFormat('MMM d, y').format(pic.createdAt.toLocal()),
                          style: const TextStyle(
                              color: Colors.white, fontSize: 9),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showPictureOptions(BuildContext context, WidgetRef ref,
      ProfilePictureModel pic, bool isCurrent) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!isCurrent)
              ListTile(
                leading: const Icon(Icons.restore_outlined),
                title: const Text('Restore this picture'),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _restorePicture(context, ref, pic.id);
                },
              ),
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text('Cancel'),
              onTap: () => Navigator.of(ctx).pop(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _restorePicture(
      BuildContext context, WidgetRef ref, String pictureId) async {
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.post<Map<String, dynamic>>(
        '/auth/profile/picture/restore',
        data: {'pictureId': pictureId},
      );
      final updatedUser = UserModel.fromJson(
        (response.data?['user'] ?? response.data!) as Map<String, dynamic>,
      );
      ref.read(authNotifierProvider.notifier).updateUser(updatedUser);
      ref.invalidate(_profilePicturesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile picture restored')),
        );
      }
    } on Exception catch (e) {
      if (context.mounted) {
        final msg = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}
