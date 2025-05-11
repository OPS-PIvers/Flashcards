/**
 * Main entry point for the Flashcard App web application.
 * Serves the HTML interface and handles routing.
 * 
 * @param {Object} e - Event object from web request
 * @return {HtmlOutput} The HTML page to be displayed
 */
function doGet(e) {
  // Get the page parameter or default to 'index'
  const page = e.parameter.page || 'index';
  
  // Get user session info if available
  const userSession = getUserSession();
  const isLoggedIn = Boolean(userSession && userSession.isValid && userSession.userName);
  
  // Prepare template data
  const templateData = {
    title: 'Flashcard App',
    isLoggedIn: isLoggedIn,
    isAdmin: isLoggedIn && userSession.isAdmin,
    userName: isLoggedIn ? userSession.userName : '',
    page: page
  };
  
  // Create and return the HTML output
  const template = HtmlService.createTemplateFromFile('index');
  template.data = templateData;
  
  const output = template.evaluate()
    .setTitle('Flashcard App')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/apps_script_48dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  return output;
}

/**
 * Includes an HTML file in another HTML file.
 * This allows for modular HTML templates.
 * 
 * @param {string} filename - The name of the HTML file to include
 * @param {Object=} data - Optional data to pass to the template
 * @return {string} The content of the HTML file
 */
function include(filename, data = {}) {
  const template = HtmlService.createTemplateFromFile(filename);
  template.data = data;
  return template.evaluate().getContent();
}

/**
 * Gets a script property, used for configuration settings
 * 
 * @param {string} key - The property key
 * @param {string=} defaultValue - Default value if property doesn't exist
 * @return {string} The property value
 */
function getScriptProperty(key, defaultValue = '') {
  const scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty(key) || defaultValue;
}

/**
 * Sets a script property for configuration
 * 
 * @param {string} key - The property key
 * @param {string} value - The value to set
 */
function setScriptProperty(key, value) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(key, value);
}

/**
 * Checks if the app has been initialized
 * 
 * @return {boolean} True if initialized, false otherwise
 */
function isAppInitialized() {
  const databaseId = getScriptProperty('databaseId');
  return !!databaseId;
}

/**
 * Initializes the app for first-time use
 * 
 * @param {Object} options - Configuration options
 * @return {Object} Result of initialization
 */
function initializeApp(options = {}) {
  if (isAppInitialized()) {
    return { success: false, message: 'App is already initialized' };
  }
  
  try {
    // Create the database
    const db = createDatabaseSpreadsheet(options.databaseName || 'Flashcard App Database');
    
    // Store the database ID
    setScriptProperty('databaseId', db.id);
    
    // Initialize the database structure
    initializeDatabaseStructure(db.id);
    
    // Create a sample deck
    createSampleDeck(db.id);
    
    return { success: true, message: 'App initialized successfully' };
  } catch (error) {
    Logger.log('Error initializing app: ' + error.message);
    return { success: false, message: 'Error initializing app: ' + error.message };
  }
}