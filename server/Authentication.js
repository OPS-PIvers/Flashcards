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
    if (!isAppInitialized()) {
      return { 
        success: false, 
        message: 'App not initialized. Please initialize first.',
        needsInit: true
      };
    }
    
    // Get user data
    const user = getUserData(username);
    
    // Check if user exists
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Check if password matches
    if (user.Password !== password) {
      return { success: false, message: 'Incorrect password' };
    }
    
    // Update last login time
    updateUserLastLogin(username);
    
    // Set user session
    const sessionData = {
      userName: user.UserName,
      firstName: user.StudentFirst,
      lastName: user.StudentLast,
      isAdmin: user.IsAdmin === 'TRUE' || user.IsAdmin === true,
      lastLogin: new Date().toISOString(),
      isValid: true
    };
    
    setUserSession(sessionData);
    
    return {
      success: true,
      message: 'Login successful',
      user: {
        userName: user.UserName,
        firstName: user.StudentFirst,
        lastName: user.StudentLast,
        isAdmin: sessionData.isAdmin
      }
    };
  } catch (error) {
    Logger.log('Authentication error: ' + error.message);
    return { success: false, message: 'Authentication error: ' + error.message };
  }
}

/**
 * Sets user session data
 * 
 * @param {Object} sessionData - Session data to store
 */
function setUserSession(sessionData) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('session', JSON.stringify(sessionData));
}

/**
 * Gets the current user session
 * 
 * @return {Object|null} Session data or null if not set
 */
function getUserSession() {
  const userProperties = PropertiesService.getUserProperties();
  const sessionJson = userProperties.getProperty('session');
  
  if (!sessionJson) {
    return null;
  }
  
  try {
    return JSON.parse(sessionJson);
  } catch (error) {
    Logger.log('Error parsing session: ' + error.message);
    return null;
  }
}

/**
 * Logs out the current user
 * 
 * @return {Object} Logout result
 */
function logoutUser() {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('session');
  
  return { success: true, message: 'Logout successful' };
}

/**
 * Checks if the current user is logged in
 * 
 * @return {boolean} True if logged in, false otherwise
 */
function isUserLoggedIn() {
  const session = getUserSession();
  return session && session.isValid;
}

/**
 * Checks if the current user is an admin
 * 
 * @return {boolean} True if admin, false otherwise
 */
function isUserAdmin() {
  const session = getUserSession();
  return session && session.isValid && session.isAdmin;
}

/**
 * Gets the current user's info
 * 
 * @return {Object|null} User info or null if not logged in
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