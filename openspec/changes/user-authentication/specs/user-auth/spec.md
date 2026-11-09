# Spec Delta

## Purpose

Provides account registration and login so visitors can authenticate and reach protected, user-specific application content.

## ADDED Requirements

### Requirement: Registration validates and normalizes account input
The system SHALL trim and lowercase email addresses before persistence, accept only valid email addresses up to 254 characters, and accept passwords from 8 through 128 characters containing at least one letter and one number.

#### Scenario: Valid registration
- **WHEN** a visitor registers with a valid email and policy-compliant password
- **THEN** the system SHALL create one account and return HTTP 201 with `id`, normalized `email`, and `createdAt`

#### Scenario: Email normalization
- **WHEN** a visitor registers using an email with surrounding whitespace or different casing from an existing account
- **THEN** the system SHALL treat it as the same normalized email address

#### Scenario: Invalid or oversized registration fields
- **WHEN** registration includes an invalid or overlong email, a missing field, or a password that violates the password rules or length limit
- **THEN** the system SHALL return HTTP 400 with per-field validation messages

### Requirement: Registration prevents duplicate accounts and protects password data
The system SHALL reject an already-registered normalized email and SHALL never return or persist a plaintext or reversibly encrypted password.

#### Scenario: Duplicate registration
- **WHEN** a visitor registers with an email address that already exists after normalization
- **THEN** the system SHALL return HTTP 409 with a clear duplicate-email message and SHALL NOT create another account

#### Scenario: Password is stored as a salted hash
- **WHEN** a valid registration is persisted
- **THEN** the stored password value SHALL be a per-user salted adaptive hash that can verify the submitted password and SHALL differ from the plaintext password

#### Scenario: Registration response excludes password data
- **WHEN** registration succeeds
- **THEN** the response SHALL NOT contain a password or password hash

### Requirement: Login issues an expiring bearer token
The system SHALL authenticate registered users and return a bearer token with an expiry and a safe user representation.

#### Scenario: Successful login
- **WHEN** a registered user submits the correct email and password
- **THEN** the system SHALL return HTTP 200 with a non-empty `token`, `expiresIn` equal to 3600 seconds, and a user containing only `id` and `email`

#### Scenario: Invalid login fields
- **WHEN** login has a missing or invalid email or a missing password
- **THEN** the system SHALL return HTTP 400 with per-field validation messages

#### Scenario: Wrong or unknown credentials
- **WHEN** login uses an unknown email or an incorrect password
- **THEN** the system SHALL return HTTP 401 with the same generic message, `Invalid email or password`

### Requirement: Protected access requires a valid token
The system SHALL allow protected user access only when a valid, unexpired bearer token is supplied.

#### Scenario: Valid token accesses protected user data
- **WHEN** an authenticated request supplies a valid bearer token
- **THEN** the system SHALL return the corresponding safe user representation

#### Scenario: Missing or expired token is rejected
- **WHEN** a protected request has no token or supplies an expired token
- **THEN** the system SHALL return HTTP 401 without disclosing protected user data

### Requirement: Authentication secrets are handled safely
The system SHALL compare password hashes in constant time and SHALL NOT log raw passwords, bearer tokens, or password hashes.

#### Scenario: Password verification
- **WHEN** a submitted password is verified against its stored hash
- **THEN** verification SHALL succeed only for the matching password and SHALL use a constant-time comparison

#### Scenario: Authentication data is not logged
- **WHEN** registration, login, or protected access is processed
- **THEN** application logs SHALL NOT contain raw passwords, bearer tokens, or password hashes

### Requirement: Registration and login forms provide usable feedback
The frontend SHALL provide registration and login forms with real-time validation, request progress feedback, and clear success and failure behavior.

#### Scenario: Form validation and in-flight submission
- **WHEN** a visitor enters invalid form values or submits a valid form
- **THEN** the frontend SHALL show inline validation, disable submission while the request is in flight, and indicate loading

#### Scenario: Toggle between registration and login
- **WHEN** a visitor follows the form-switch link
- **THEN** the frontend SHALL switch between registration and login views

#### Scenario: Successful login reaches protected content
- **WHEN** login succeeds
- **THEN** the frontend SHALL persist the returned token for the current browser tab and navigate to a protected landing page

#### Scenario: Server-side errors are displayed
- **WHEN** registration or login fails
- **THEN** the frontend SHALL display the server's safe error message without exposing credentials or implementation details
