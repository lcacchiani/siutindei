# Custom Exceptions

Typed exceptions provide specific error handling following Flutter architecture recommendations.

## Overview

The `AppException` hierarchy provides:
- Type-safe exception handling
- User-friendly error messages
- Retry information for recoverable errors
- Consistent error formatting across the app

## Location

```
lib/core/exceptions/
├── exceptions.dart       # Barrel file
└── app_exceptions.dart   # Exception classes
```

## Exception Hierarchy

```dart
sealed class AppException implements Exception {
  final String message;
  final Object? originalError;
}

final class NetworkException extends AppException { ... }
final class DataException extends AppException { ... }
final class AuthException extends AppException { ... }
final class CacheException extends AppException { ... }
final class BusinessException extends AppException { ... }
```

## Exception Types

### NetworkException

For network-related errors:

```dart
NetworkException.noConnection()       // No internet
NetworkException.timeout()            // Request timeout
NetworkException.serverError(500)     // Server error
NetworkException.fromError(error)     // Generic network error
```

### DataException

For data parsing/validation errors:

```dart
DataException.invalidFormat('JSON parsing failed')
DataException.missingField('user_id')
DataException.validationFailed('Email format invalid')
```

### AuthException

For authentication errors:

```dart
AuthException.notAuthenticated()
AuthException.sessionExpired()
AuthException.invalidCredentials()
AuthException.accountNotFound()
```

### CacheException

For cache-related errors:

```dart
CacheException.notFound('search_results')
CacheException.expired('user_profile')
CacheException.writeFailed('activity_detail')
```

### BusinessException

For business logic errors:

```dart
BusinessException.invalidInput('Age must be positive')
BusinessException.notAllowed('Cannot delete active activity')
BusinessException.notFound('Activity')
```

## Usage

### In Repositories

```dart
Future<Result<Data>> fetchData() async {
  try {
    final response = await api.get();
    return Result.ok(response);
  } on SocketException catch (e) {
    return Result.error(NetworkException.fromError(e));
  } on TimeoutException {
    return Result.error(NetworkException.timeout());
  } on FormatException catch (e) {
    return Result.error(DataException.invalidFormat(e.message));
  }
}
```

### In ViewModels

```dart
String _formatError(Exception e) {
  if (e is AppException) {
    return e.displayMessage; // User-friendly message
  }
  return 'An error occurred';
}

bool get isErrorRetryable {
  final error = state.lastError;
  if (error is AppException) {
    return error.isRetryable;
  }
  return false;
}
```

### In UI

```dart
Widget build(BuildContext context) {
  if (state.hasError) {
    final isRetryable = viewModel.isErrorRetryable;
    return ErrorView(
      message: state.errorMessage,
      showRetry: isRetryable,
      onRetry: isRetryable ? viewModel.retry : null,
    );
  }
  return Content();
}
```

## Display Messages

Each exception type provides user-friendly messages:

```dart
extension AppExceptionDisplay on AppException {
  String get displayMessage {
    return switch (this) {
      NetworkException(:final message) => _networkMessage(message),
      AuthException() => message,
      DataException() => 'Something went wrong. Please try again.',
      CacheException() => 'Unable to load cached data.',
      BusinessException() => message,
    };
  }
}
```

## Retry Information

```dart
extension AppExceptionDisplay on AppException {
  bool get isRetryable {
    return switch (this) {
      NetworkException() => true,  // Network errors are retryable
      AuthException() => false,    // Auth errors need user action
      DataException() => false,    // Data errors won't fix on retry
      CacheException() => true,    // Cache errors might resolve
      BusinessException() => false, // Business errors need user action
    };
  }
}
```

## Pattern Matching

Use Dart 3 pattern matching for specific handling:

```dart
void handleError(AppException e) {
  switch (e) {
    case NetworkException(message: final msg) when msg.contains('timeout'):
      showTimeoutDialog();
    case NetworkException():
      showNetworkErrorSnackbar();
    case AuthException():
      navigateToLogin();
    case BusinessException(message: final msg):
      showErrorDialog(msg);
    default:
      showGenericErrorSnackbar();
  }
}
```

## Testing

```dart
test('NetworkException provides user-friendly message', () {
  final exception = NetworkException.noConnection();
  
  expect(exception.displayMessage, contains('internet'));
  expect(exception.isRetryable, isTrue);
});

test('AuthException is not retryable', () {
  final exception = AuthException.sessionExpired();
  
  expect(exception.isRetryable, isFalse);
});
```

## Related

- [Result Type](result.md) - Error wrapping with Result
- [ViewModels](../viewmodels/README.md) - Error handling in state
- [Architecture Recommendations](../architecture-recommendations.md) - Error handling patterns
