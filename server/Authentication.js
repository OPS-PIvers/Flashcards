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
    if (user) {
      // Force admin status check directly from spreadsheet
      Logger.log(`Forcing admin status check for ${username}`);
      try {
        const ss = getDatabaseSpreadsheet();
        const configSheet = ss.getSheetByName('Config');
        const headers = configSheet.getRange(1, 1, 1, configSheet.getLastColumn()).getValues()[0];
        const isAdminColIndex = headers.indexOf('IsAdmin');
        const usernameColIndex = headers.indexOf('UserName');
        
        if (isAdminColIndex !== -1 && usernameColIndex !== -1) {
          const allData = configSheet.getDataRange().getValues();
          for (let i = 1; i < allData.length; i++) {
            if (allData[i][usernameColIndex] === username) {
              // Get the actual cell to use isChecked() method
              const isAdminCell = configSheet.getRange(i+1, isAdminColIndex+1);
              const isChecked = isAdminCell.isChecked();
              Logger.log(`CRITICAL: For ${username}, IsAdmin checkbox is ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);
              user.IsAdmin = isChecked; // Override with direct checkbox state
              break;
            }
          }
        }
      } catch (e) {
        Logger.log(`Error in direct admin check: ${e.message}`);
        // Continue with existing user object if this fails
      }
    }
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

    // Log the raw IsAdmin value from the sheet
    Logger.log(`authenticateUser: For user "${username}", raw user.IsAdmin value from sheet: "${user.IsAdmin}", type: ${typeof user.IsAdmin}`);

    // Determine isAdmin status more robustly - improved detection logic
    let isAdmin = false;
    if (typeof user.IsAdmin === 'boolean') {
      isAdmin = user.IsAdmin; // Directly use the boolean value
    } else if (typeof user.IsAdmin === 'string') {
      // Handle string values case-insensitively
      const adminString = user.IsAdmin.trim().toUpperCase();
      isAdmin = adminString === 'TRUE' || adminString === 'YES' || adminString === '1';
    } else if (typeof user.IsAdmin === 'number') {
      // Handle numeric values (1 = true, anything else = false)
      isAdmin = user.IsAdmin === 1;
    }

    Logger.log(`authenticateUser: For user "${username}", calculated isAdmin for session: ${isAdmin}, type: ${typeof isAdmin}`);

    const sessionData = {
      userName: user.UserName,
      firstName: user.StudentFirst,
      lastName: user.StudentLast,
      isAdmin: Boolean(isAdmin), // Force to boolean type for consistency
      lastLogin: new Date().toISOString(),
      isValid: true
    };

    // Log session data before setting
    Logger.log(`Setting session data for user "${username}": ${JSON.stringify(sessionData)}`);

    setUserSession(sessionData);
    Logger.log(`User logged in successfully: ${username}, Admin: ${isAdmin}. Session data set: ${JSON.stringify(sessionData)}`);

    return {
      success: true,
      message: 'Login successful!',
      user: {
        userName: user.UserName,
        firstName: user.StudentFirst,
        lastName: user.StudentLast,
        isAdmin: Boolean(isAdmin) // Force to boolean type for consistency
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