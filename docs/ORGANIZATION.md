# Documentation Organization

This document describes the documentation structure and organization for the Teamly project.

## Directory Structure

```
Teamly/
├── README.md                          # Main project documentation
├── docs/                              # Documentation directory
│   ├── API_DOCUMENTATION.md          # Detailed API reference
│   ├── DEPLOYMENT.md                 # Production deployment guide
│   ├── QUICK_START.md                # Quick setup instructions
│   ├── SECURITY.md                   # Security features and best practices
│   ├── archive/                      # Historical documentation
│   │   ├── README.md                 # Archive index
│   │   └── [historical docs...]      # Old implementation summaries
│   ├── features/                     # Feature-specific documentation
│   │   └── ENHANCED_NOTIFICATIONS.md # Enhanced notification system
│   ├── guides/                       # User and developer guides
│   │   ├── AUTH_SECURITY_GUIDE.md    # Authentication & security
│   │   ├── FEATURES.md               # Core features guide
│   │   ├── FEATURE_ROADMAP.md        # Future features and ideas
│   │   ├── FRONTEND_GUIDE.md         # Frontend implementation
│   │   ├── SOCIAL_LOGIN_GUIDE.md     # Social authentication
│   │   ├── WINDOWS_SETUP.md          # Windows development setup
│   │   └── setup/                    # Setup guides
│   │       ├── GOOGLE_MAPS_SETUP.md  # Google Maps integration
│   │       └── TRANSLATIONS.md       # Translation system
│   └── examples/                     # Code examples
└── scripts/                          # Scripts directory
    ├── README.md                     # Scripts documentation
    ├── tests/                        # Test scripts
    │   ├── test-api.sh              # Main API tests
    │   ├── test-api.bat             # Windows version
    │   └── [other test scripts...]  # Feature-specific tests
    └── [maintenance scripts...]      # Maintenance and utility scripts
```

## Documentation Categories

### Core Documentation (`docs/`)

Essential documentation for understanding and using the project:
- **API_DOCUMENTATION.md** - Complete API reference with endpoints, parameters, and examples
- **DEPLOYMENT.md** - Deployment instructions for various environments
- **QUICK_START.md** - Quick setup guide for getting started fast
- **SECURITY.md** - Security features, best practices, and configuration

### Features (`docs/features/`)

Documentation for specific features:
- **ENHANCED_NOTIFICATIONS.md** - Enhanced notification system with real-time updates

### Guides (`docs/guides/`)

User and developer guides organized by topic:
- Platform-specific guides (Windows, frontend)
- Feature implementation guides
- Setup and configuration guides
- Future planning and roadmap

### Archive (`docs/archive/`)

Historical documentation preserved for reference:
- Implementation summaries from feature development
- Historical reports and comparisons
- Old feature documentation

See [docs/archive/README.md](archive/README.md) for details.

## Scripts Organization

### Test Scripts (`scripts/tests/`)

All test scripts have been moved to `scripts/tests/` for better organization:
- Run with: `./scripts/tests/test-api.sh` (Unix) or `scripts\tests\test-api.bat` (Windows)
- See [scripts/README.md](../scripts/README.md) for full documentation

### Maintenance Scripts (`scripts/`)

Maintenance and utility scripts in the root scripts directory:
- Event maintenance and cleanup
- Scheduled tasks and reminders
- Backend testing and validation

## Navigation Tips

### From Root Directory
- Start with `README.md` for project overview
- Check `docs/QUICK_START.md` to get running quickly
- Browse `docs/guides/` for specific topics

### From Documentation
- Core docs use relative paths: `../API_DOCUMENTATION.md`
- Guides use relative paths: `../DEPLOYMENT.md` or `setup/GOOGLE_MAPS_SETUP.md`
- Main README: `../../README.md`

### Finding Documentation
1. **For API usage**: `docs/API_DOCUMENTATION.md`
2. **For deployment**: `docs/DEPLOYMENT.md`
3. **For features**: `docs/guides/FEATURES.md`
4. **For setup help**: `docs/guides/WINDOWS_SETUP.md` or `docs/guides/setup/`
5. **For security**: `docs/SECURITY.md`

## Benefits of This Organization

1. **Cleaner Root**: Only essential files in root directory
2. **Logical Grouping**: Related docs together by category
3. **Easy Navigation**: Clear hierarchy and consistent paths
4. **Historical Preservation**: Old docs archived but accessible
5. **Better Discoverability**: Organized structure makes finding docs easier
6. **Scalability**: Easy to add new docs in appropriate categories

## Maintenance

When adding new documentation:
1. Place it in the appropriate directory based on type
2. Update this organization guide if adding new categories
3. Ensure cross-references use relative paths
4. Update the main README if it's core documentation
5. Add to archive if deprecating old documentation
