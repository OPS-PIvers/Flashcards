/**
 * Authentication Module for Flashcard App
 * Handles user login, logout, session management, and role checks.
 */

/**
 * Authenticates a user based on username and password
 *
 * @param {string} username - The username
 * @param {string} password - The password
 * @return {Object} Authentication result
 */
function authenticateUser(username, password) {
  try {
    // Check if the app is initialized
    if (!isAppInitialized()) { // Assumes isAppInitialized is defined (e.g., in Code.js)
      return {
        success: false,
        message: 'Application needs to be initialized by an administrator.',
        needsInit: true
      };
    }

    // Get user data
    const user = getUserData(username); // Assumes getUserData is defined (e.g., in Database.js)

    // Check if user exists
    if (!user) {
      Logger.log(`Login attempt failed: User not found - ${username}`);
      return { success: false, message: 'Invalid username or password.' }; // Generic message for security
    }

    // Check if password matches
    // !!! SECURITY WARNING: Storing and comparing plain text passwords is not secure.
    // Consider implementing password hashing for any production or sensitive environment.
    if (user.Password !== password) {
      Logger.log(`Login attempt failed: Incorrect password for user - ${username}`);
      return { success: false, message: 'Invalid username or password.' }; // Generic message
    }

    // Update last login time
    updateUserLastLogin(username); // Assumes updateUserLastLogin is defined (e.g., in Database.js)

    // Set user session
    Logger.log(`authenticateUser: For user "${username}", user.IsAdmin value from sheet: "${user.IsAdmin}", type: ${typeof user.IsAdmin}`);

    const isAdmin = user.IsAdmin === 'TRUE' || user.IsAdmin === true;

    // ADD THIS LOGGING:
    Logger.log(`authenticateUser: For user "${username}", calculated isAdmin for session: ${isAdmin}, type: ${typeof isAdmin}`);

    const sessionData = {
      userName: user.UserName,
      firstName: user.StudentFirst,
      lastName: user.StudentLast,
      isAdmin: isAdmin,
      lastLogin: new Date().toISOString(),
      isValid: true
    };

    setUserSession(sessionData);
    Logger.log(`User logged in successfully: ${username}, Admin: ${isAdmin}`);

    return {
      success: true,
      message: 'Login successful!',
      user: {
        userName: user.UserName,
        firstName: user.StudentFirst,
        lastName: user.StudentLast,
        isAdmin: isAdmin
      }
    };
  } catch (error) {
    Logger.log(`Authentication error for user "${username}": ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: 'An unexpected error occurred during authentication. Please try again.' };
  }
}

/**
 * Sets user session data in UserProperties
 *
 * @param {Object} sessionData - Session data to store
 */
function setUserSession(sessionData) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('session', JSON.stringify(sessionData));
  } catch (e) {
    Logger.log(`Failed to set user session: ${e.message}`);
    // Depending on severity, you might want to throw this error
    // or handle it by returning a failure from the calling function.
  }
}

/**
 * Gets the current user session from UserProperties
 *
 * @return {Object|null} Session data or null if not set or invalid
 */
function getUserSession() {
  const userProperties = PropertiesService.getUserProperties();
  const sessionJson = userProperties.getProperty('session');

  if (!sessionJson) {
    return null;
  }

  try {
    const session = JSON.parse(sessionJson);
    // Basic validation of session object structure
    if (session && typeof session.userName === 'string' && typeof session.isValid === 'boolean') {
        return session;
    }
    Logger.log("Invalid session structure found in UserProperties.");
    userProperties.deleteProperty('session'); // Clear invalid session
    return null;
  } catch (error) {
    Logger.log(`Error parsing session from UserProperties: ${error.message}`);
    userProperties.deleteProperty('session'); // Clear corrupted session
    return null;
  }
}

/**
 * Logs out the current user by deleting their session data
 *
 * @return {Object} Logout result
 */
function logoutUser() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const session = userProperties.getProperty('session');
    if (session) {
        const parsedSession = JSON.parse(session); // To log which user is logging out
        Logger.log(`User logging out: ${parsedSession.userName}`);
    }
    userProperties.deleteProperty('session');
    return { success: true, message: 'You have been logged out successfully.' };
  } catch (e) {
      Logger.log(`Error during logout: ${e.message}`);
      return { success: false, message: 'An error occurred during logout. Please close the browser tab.' };
  }
}

/**
 * Checks if the current user is logged in (i.e., has a valid session)
 *
 * @return {boolean} True if logged in, false otherwise
 */
function isUserLoggedIn() {
  const session = getUserSession();
  return session && session.isValid === true;
}

/**
 * Checks if the current user is an admin.
 * This is the authoritative function for server-side admin checks.
 *
 * @return {boolean} True if admin, false otherwise
 */
function isUserAdmin() {
  const session = getUserSession();
  return session && session.isValid === true && session.isAdmin === true;
}

/**
 * Gets the current user's info if logged in
 *
 * @return {Object|null} User info object or null if not logged in
 */
function getCurrentUserInfo() {
  const session = getUserSession();

  if (!session || !session.isValid) {
    return null;
  }

  return {
    userName: session.userName,
    firstName: session.firstName,
    lastName: session.lastName,
    isAdmin: session.isAdmin
  };
}