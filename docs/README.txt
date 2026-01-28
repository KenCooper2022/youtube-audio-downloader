================================================================================
SOUNDGRAB - TECHNICAL DOCUMENTATION INDEX
================================================================================
Last Updated: January 28, 2026

================================================================================
DOCUMENT OVERVIEW
================================================================================

This documentation package provides comprehensive technical reference for the
SoundGrab YouTube audio downloader application. Each document serves a specific
purpose and is intended to be read by engineers who will maintain, debug, or
extend the codebase.

================================================================================
DOCUMENT LIST
================================================================================

01-ARCHITECTURE-OVERVIEW.txt
  Purpose: High-level system architecture and technology decisions
  Audience: New team members, architects, senior engineers
  Contents:
    - System overview and capabilities
    - Complete technology stack
    - Directory structure explanation
    - Data flow architecture
    - Component interaction diagrams
    - Design philosophy

02-FRONTEND-COMPONENTS.txt
  Purpose: Detailed React component documentation
  Audience: Frontend developers
  Contents:
    - Entry points (main.tsx, App.tsx)
    - Page components (Home.tsx)
    - Feature components (SearchBar, SearchResults, Library, etc.)
    - State management patterns
    - Event handlers and callbacks
    - IndexedDB wrapper (db.ts)
    - Styling system (index.css)

03-BACKEND-API.txt
  Purpose: Complete API reference and server implementation
  Audience: Backend developers, API consumers
  Contents:
    - Server configuration
    - API endpoint documentation
    - Request/response formats
    - Helper function implementations
    - yt-dlp integration details
    - Error handling strategy

04-DATA-SCHEMAS.txt
  Purpose: Data structure and type definitions reference
  Audience: Full-stack developers
  Contents:
    - Schema design philosophy
    - Zod schema definitions
    - TypeScript interfaces
    - IndexedDB schema
    - API request/response shapes
    - Type relationships diagram

05-DESIGN-DECISIONS.txt
  Purpose: Architectural decision rationale and trade-offs
  Audience: Tech leads, architects, new team members
  Contents:
    - Technology selection decisions
    - Architecture decisions
    - Data storage decisions
    - UI/UX design decisions
    - Security decisions
    - Performance decisions
    - Future considerations

06-VARIABLE-FUNCTION-REFERENCE.txt
  Purpose: Complete code reference index
  Audience: All developers
  Contents:
    - Server constants and variables
    - Server functions with signatures
    - Client constants and variables
    - Client functions and hooks
    - Shared types and schemas
    - CSS variables reference

07-DATABASE-DOCUMENTATION.txt
  Purpose: Comprehensive PostgreSQL database documentation
  Audience: Database administrators, backend developers, full-stack engineers
  Contents:
    - Database overview and technology stack
    - Complete schema definition (SQL and Drizzle)
    - All SQL operations with equivalent code
    - Server and client code interfacing
    - Type definitions and Zod schemas
    - Migration and schema change procedures
    - Error handling patterns
    - Advanced query examples
    - Security considerations

================================================================================
READING ORDER RECOMMENDATIONS
================================================================================

FOR NEW TEAM MEMBERS:
  1. 01-ARCHITECTURE-OVERVIEW.txt (understand the big picture)
  2. 05-DESIGN-DECISIONS.txt (understand why things are built this way)
  3. 04-DATA-SCHEMAS.txt (understand the data model)
  4. Component docs as needed (02/03)

FOR DEBUGGING:
  1. 06-VARIABLE-FUNCTION-REFERENCE.txt (quick lookup)
  2. Relevant component doc (02 or 03)

FOR EXTENDING FUNCTIONALITY:
  1. 04-DATA-SCHEMAS.txt (understand existing data model)
  2. Relevant component doc (02 or 03)
  3. 05-DESIGN-DECISIONS.txt (understand patterns to follow)

FOR API INTEGRATION:
  1. 03-BACKEND-API.txt (complete API reference)
  2. 04-DATA-SCHEMAS.txt (request/response formats)

================================================================================
DOCUMENT CONVENTIONS
================================================================================

CODE BLOCKS:
  Inline code uses backticks: `variableName`
  Multi-line code is indented and prefixed with ```

SIGNATURES:
  Function signatures use TypeScript notation:
  functionName(param1: Type1, param2: Type2): ReturnType

DESIGN DECISIONS:
  Each major decision documents:
  - Alternatives considered
  - Rationale for chosen approach
  - Trade-offs and implications

CROSS-REFERENCES:
  Documents reference each other by filename

================================================================================
MAINTENANCE
================================================================================

When making code changes, update relevant documentation:

1. New API endpoint → Update 03-BACKEND-API.txt
2. New component → Update 02-FRONTEND-COMPONENTS.txt
3. New data type → Update 04-DATA-SCHEMAS.txt
4. Architecture change → Update 01-ARCHITECTURE-OVERVIEW.txt
5. New function/variable → Update 06-VARIABLE-FUNCTION-REFERENCE.txt

================================================================================
CONTACT
================================================================================

For questions about this documentation or the codebase:
  - Review the relevant document first
  - Check 06-VARIABLE-FUNCTION-REFERENCE.txt for quick lookups
  - Consult 05-DESIGN-DECISIONS.txt for "why" questions

================================================================================
END OF INDEX
================================================================================
