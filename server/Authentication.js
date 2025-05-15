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
// In server/Authentication.js - Update the authenticateUser function

function authenticateUser(username, password) {
  try {
    // Check if the app is initialized
    if (!isAppInitialized()) {
      return {
        success: false,
        message: 'Application needs to be initialized by an administrator.',
        needsInit: true
      };
    }

    // Get user data
    const user = getUserData(username);

    // Check if user exists
    if (!user) {
      Logger.log(`Login attempt failed: User not found - ${username}`);
      return { success: false, message: 'Invalid username or password.' };
    }

    // Check if password matches
    if (user.Password !== password) {
      Logger.log(`Login attempt failed: Incorrect password for user - ${username}`);
      return { success: false, message: 'Invalid username or password.' };
    }

    // Update last login time
    updateUserLastLogin(username);

    // CRITICAL FIX: Directly check admin status from the sheet instead of relying on user object
    const isAdminFromSheet = isUserAdminInSheet(username);
    Logger.log(`authenticateUser: Direct admin check from sheet for ${username}: ${isAdminFromSheet}`);

    // Use the direct result from the sheet
    const sessionData = {
      userName: user.UserName,
      firstName: user.StudentFirst,
      lastName: user.StudentLast,
      isAdmin: isAdminFromSheet, // Use direct check result
      lastLogin: new Date().toISOString(),
      isValid: true
    };

    setUserSession(sessionData);
    Logger.log(`User logged in successfully: ${username}, Admin: ${isAdminFromSheet}. Session data set: ${JSON.stringify(sessionData)}`);

    return {
      success: true,
      message: 'Login successful!',
      user: {
        userName: user.UserName,
        firstName: user.StudentFirst,
        lastName: user.StudentLast,
        isAdmin: isAdminFromSheet // Use direct check result
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
    // Validation to ensure isAdmin is explicitly a boolean
    if (sessionData && 'isAdmin' in sessionData) {
      sessionData.isAdmin = Boolean(sessionData.isAdmin);
    }
    
    const userProperties = PropertiesService.getUserProperties();
    const sessionJson = JSON.stringify(sessionData);
    userProperties.setProperty('session', sessionJson);
    Logger.log(`Session data set successfully: ${sessionJson}`);
  } catch (e) {
    Logger.log(`Failed to set user session: ${e.message}\nStack: ${e.stack}`);
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
    Logger.log("getUserSession: No session found in UserProperties");
    return null;
  }

  try {
    const session = JSON.parse(sessionJson);
    
    // Basic validation of session object structure
    if (!session || typeof session !== 'object') {
      Logger.log(`getUserSession: Invalid session format, not an object: ${sessionJson}`);
      userProperties.deleteProperty('session');
      return null;
    }
    
    // Check for required properties
    if (typeof session.userName !== 'string') {
      Logger.log(`getUserSession: Invalid session - userName missing or not a string: ${sessionJson}`);
      userProperties.deleteProperty('session');
      return null;
    }
    
    if (typeof session.isValid !== 'boolean') {
      Logger.log(`getUserSession: Invalid session - isValid missing or not a boolean: ${sessionJson}`);
      userProperties.deleteProperty('session');
      return null;
    }
    
    // Force isAdmin to be a boolean regardless of how it was stored
    if ('isAdmin' in session) {
      session.isAdmin = Boolean(session.isAdmin);
    } else {
      Logger.log(`getUserSession: isAdmin missing in session, setting to false: ${sessionJson}`);
      session.isAdmin = false;
    }
    
    Logger.log(`getUserSession: Retrieved valid session for user ${session.userName}, isAdmin=${session.isAdmin}`);
    return session;
  } catch (error) {
    Logger.log(`Error parsing session from UserProperties: ${error.message}. Session data: ${sessionJson}. Deleting session property.`);
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
    const sessionJson = userProperties.getProperty('session'); // Renamed to avoid conflict
    if (sessionJson) { // Check if sessionJson is not null
        try {
            const parsedSession = JSON.parse(sessionJson); // To log which user is logging out
            Logger.log(`User logging out: ${parsedSession.userName}, isAdmin=${parsedSession.isAdmin}`);
        } catch (e) {
            Logger.log(`Could not parse session during logout, but proceeding to delete. Error: ${e.message}`);
        }
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
  if (!session) {
    Logger.log('isUserAdmin check: No valid session found');
    return false;
  }
  
  // Explicitly debug the session properties
  Logger.log(`isUserAdmin check: Session content: isValid=${session.isValid}, isAdmin=${session.isAdmin}, type of isAdmin=${typeof session.isAdmin}`);
  
  // Ensure both isValid and isAdmin are treated as booleans
  const isValidSession = Boolean(session.isValid);
  const hasAdminRole = Boolean(session.isAdmin);
  
  const isAdminResult = isValidSession && hasAdminRole;
  Logger.log(`isUserAdmin check: Final result=${isAdminResult}`);
  return isAdminResult;
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
    isAdmin: Boolean(session.isAdmin) // Force boolean type for consistency
  };
}