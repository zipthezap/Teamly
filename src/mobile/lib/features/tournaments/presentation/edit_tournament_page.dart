import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';


class EditTournamentPage extends ConsumerStatefulWidget {
  const EditTournamentPage({
    super.key,
    required this.tournamentId,
    this.tournament,
  });

  final String tournamentId;
  final TournamentModel? tournament;

  @override
  ConsumerState<EditTournamentPage> createState() => _EditTournamentPageState();
}

class _EditTournamentPageState extends ConsumerState<EditTournamentPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _rulesCtrl = TextEditingController();
  final _prizesCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'single_elimination';
  DateTime? _startDate;
  DateTime? _endDate;
  DateTime? _registrationStartDate;
  DateTime? _registrationDeadline;
  bool _useManualBrackets = false;
  bool _saving = false;
  bool _pageLoading = false;

  @override
  void initState() {
    super.initState();
    final t = widget.tournament;
    if (t != null) {
      _populateFromTournament(t);
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fetchTournament());
    }
  }

  void _populateFromTournament(TournamentModel t) {
    _nameCtrl.text = t.name;
    _descCtrl.text = t.description ?? '';
    _maxTeamsCtrl.text = t.maxTeams?.toString() ?? '';
    _locationCtrl.text = t.location ?? t.locationName ?? '';
    _rulesCtrl.text = t.rulesDescription ?? '';
    _prizesCtrl.text = t.prizesDescription ?? '';
    _sportType = t.sportType;
    _format = t.format;
    _startDate = t.startDate;
    _endDate = t.endDate;
    _registrationStartDate = t.registrationStartDate;
    _registrationDeadline = t.registrationDeadline;
    _useManualBrackets = t.useManualBrackets;
  }

  Future<void> _fetchTournament() async {
    setState(() => _pageLoading = true);
    try {
      final t = await ref.read(tournamentRepositoryProvider).getTournament(widget.tournamentId);
      if (mounted) {
        setState(() {
          _populateFromTournament(t);
          _pageLoading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted) {
        setState(() => _pageLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    _locationCtrl.dispose();
    _rulesCtrl.dispose();
    _prizesCtrl.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? initial, {DateTime? firstDate}) async {
    return showDatePicker(
      context: context,
      initialDate: initial ?? (firstDate ?? DateTime.now()).add(const Duration(days: 7)),
      firstDate: firstDate ?? DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_startDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a tournament start date')),
      );
      return;
    }
    if (_endDate != null && !_endDate!.isAfter(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tournament end date must be after start date')),
      );
      return;
    }
    if (_registrationStartDate != null && !_registrationStartDate!.isBefore(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration open date must be before the tournament start date')),
      );
      return;
    }
    if (_registrationDeadline != null && !_registrationDeadline!.isBefore(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration deadline must be before the tournament start date')),
      );
      return;
    }
    if (_registrationStartDate != null &&
        _registrationDeadline != null &&
        !_registrationDeadline!.isAfter(_registrationStartDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration deadline must be after the registration open date')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await ref.read(tournamentRepositoryProvider).updateTournament(widget.tournamentId, {
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        'description': _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : null,
        if (_maxTeamsCtrl.text.trim().isNotEmpty) 'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
        if (_endDate != null) 'endDate': _endDate!.toIso8601String(),
        if (_registrationStartDate != null) 'registrationStartDate': _registrationStartDate!.toIso8601String(),
        if (_registrationDeadline != null) 'registrationDeadline': _registrationDeadline!.toIso8601String(),
        'location': _locationCtrl.text.trim().isNotEmpty ? _locationCtrl.text.trim() : null,
        'rulesDescription': _rulesCtrl.text.trim().isNotEmpty ? _rulesCtrl.text.trim() : null,
        'prizesDescription': _prizesCtrl.text.trim().isNotEmpty ? _prizesCtrl.text.trim() : null,
        'useManualBrackets': _useManualBrackets,
      });
      ref.read(tournamentsNotifierProvider.notifier).reload();
      ref.invalidate(tournamentDetailProvider(widget.tournamentId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tournament updated!')));
      context.pop(true);
    } on Exception catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(extractErrorMessage(error)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateTile({required String label, required DateTime? value, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, prefixIcon: const Icon(Icons.calendar_today_outlined)),
        child: Text(
          value != null ? DateFormat.yMMMd().format(value) : 'Tap to select',
          style: TextStyle(
            color: value == null ? AppThemeTokens.textSecondary(context) : AppThemeTokens.text(context),
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Tournament')),
      body: _pageLoading ? const Center(child: CircularProgressIndicator()) : Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            UiSectionTitle('Basic Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Tournament name *', prefixIcon: Icon(Icons.emoji_events_outlined)),
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _sportType.isNotEmpty ? _sportType : null,
              decoration: const InputDecoration(labelText: 'Sport type *', prefixIcon: Icon(Icons.sports_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: kSportTypes.where((s) => s['value']!.isNotEmpty).map((s) => DropdownMenuItem(value: s['value'], child: Text(s['label']!))).toList(),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _format,
              decoration: const InputDecoration(labelText: 'Format *', prefixIcon: Icon(Icons.account_tree_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: const [
                DropdownMenuItem(value: 'single_elimination', child: Text('Single Elimination')),
                DropdownMenuItem(value: 'round_robin', child: Text('Round Robin')),
                DropdownMenuItem(value: 'groups_knockout', child: Text('Groups + Knockout')),
              ],
              onChanged: (v) => setState(() => _format = v ?? 'single_elimination'),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Description', prefixIcon: Icon(Icons.notes_outlined), alignLabelWithHint: true),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _maxTeamsCtrl,
              decoration: const InputDecoration(labelText: 'Max teams', prefixIcon: Icon(Icons.group_outlined)),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Dates'),
            const SizedBox(height: 8),
            _dateTile(label: 'Registration opens', value: _registrationStartDate, onTap: () async { final d = await _pickDate(_registrationStartDate); if (d != null) setState(() => _registrationStartDate = d); }),
            const SizedBox(height: 12),
            _dateTile(label: 'Registration deadline', value: _registrationDeadline, onTap: () async { final d = await _pickDate(_registrationDeadline); if (d != null) setState(() => _registrationDeadline = d); }),
            const SizedBox(height: 12),
            _dateTile(label: 'Tournament start', value: _startDate, onTap: () async { final d = await _pickDate(_startDate); if (d != null) setState(() => _startDate = d); }),
            const SizedBox(height: 12),
            _dateTile(label: 'Tournament end', value: _endDate, onTap: () async { final d = await _pickDate(_endDate, firstDate: _startDate); if (d != null) setState(() => _endDate = d); }),
            const SizedBox(height: 24),
            UiSectionTitle('Location'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(labelText: 'Location / Venue', prefixIcon: Icon(Icons.location_on_outlined)),
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Additional Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _rulesCtrl,
              decoration: const InputDecoration(labelText: 'Rules', prefixIcon: Icon(Icons.rule_outlined), alignLabelWithHint: true),
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _prizesCtrl,
              decoration: const InputDecoration(labelText: 'Prizes', prefixIcon: Icon(Icons.card_giftcard_outlined), alignLabelWithHint: true),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Settings'),
            SwitchListTile(
              title: const Text('Manual pool/bracket management'),
              subtitle: const Text('Manually create pools and assign teams instead of auto-generating'),
              value: _useManualBrackets,
              onChanged: (v) => setState(() => _useManualBrackets = v),
            ),
            const SizedBox(height: 28),
            UiPrimaryButton(
              text: 'Save Changes',
              icon: Icons.save_outlined,
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Matches Management Page
// ===========================================================================
