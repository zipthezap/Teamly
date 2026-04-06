import '../../../core/models/group_model.dart';

abstract class GroupRepository {
  Future<List<GroupModel>> getGroups();
  Future<GroupModel> getGroup(String id);
}
