/**
 * Main entry point for the Flashcard App web application.
 * Serves the HTML interface and handles basic routing via query parameters.
 *
 * @param {Object} e - Event object from web request (contains query parameters)
 * @return {HtmlService.HtmlOutput} The HTML page to be displayed
 */
function doGet(e) {
  try {
    // Get the page parameter or default to 'index' (though 'index' isn't explicitly handled as a separate page)
    const page = e.parameter.page || 'index'; // 'page' param is not heavily used in current client-side routing

    // Get user session info if available
    const userSession = getUserSession(); // From Authentication.js

    // Prepare template data
    const templateData = {
      title: 'Flashcard App Deluxe', // Updated title
      isLoggedIn: userSession !== null && userSession.isValid === true,
      isAdmin: userSession !== null && userSession.isValid === true && userSession.isAdmin === true,
      userName: userSession !== null && userSession.isValid === true ? userSession.userName : '',
      page: page // This could be used for deep linking if client-side routing supported it more directly
    };
    
    Logger.log(`Serving page for user: ${templateData.userName || 'Guest'}, Admin: ${templateData.isAdmin}, LoggedIn: ${templateData.isLoggedIn}`);

    // Create and return the HTML output from the main 'index.html' template
    const template = HtmlService.createTemplateFromFile('client/index');
    template.data = templateData; // Pass data to the template

    const output = template.evaluate()
      .setTitle(templateData.title)
      .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/apps_script_48dp.png') // Default Apps Script icon
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, shrink-to-fit=no'); // Ensure responsiveness

    return output;
  } catch (error) {
    Logger.log(`Error in doGet: ${error.message}\nStack: ${error.stack}`);
    // Fallback to a simple error page or message
    return HtmlService.createHtmlOutput(
      `<h1>An error occurred</h1><p>Sorry, the application encountered an error. Please try again later.</p><p><small>Error: ${escapeHtml(error.message)}</small></p>`
    ).setTitle("Application Error");
  }
}

/**
 * Includes an HTML file's content within another HTML template.
 * This enables modular HTML design (partials/components).
 *
 * @param {string} filename - The name of the HTML file to include (e.g., 'partials/login')
 * @param {Object=} data - Optional data object to pass to the included template
 * @return {string} The evaluated HTML content of the specified file
 */
function include(filename, data = {}) {
  try {
    const template = HtmlService.createTemplateFromFile(filename);
    if (data) { // Ensure data is passed only if provided
      template.data = data;
    }
    return template.evaluate().getContent();
  } catch (error) {
    Logger.log(`Error including file "${filename}": ${error.message}`);
    // Return an error message in the UI where the include was supposed to be
    return `<div style="color:red; border:1px solid red; padding:10px;">Error including template: ${filename}. Details: ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Gets a script property value from PropertiesService.
 * Used for application-level configuration settings.
 *
 * @param {string} key - The property key
 * @param {string=} defaultValue - Optional default value if the property is not found
 * @return {string|null} The property value, or defaultValue, or null if not found and no default.
 */
function getScriptProperty(key, defaultValue = null) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const value = scriptProperties.getProperty(key);
  return value !== null ? value : defaultValue; // Check for null explicitly, as empty string is a valid property
}

/**
 * Sets a script property value in PropertiesService.
 *
 * @param {string} key - The property key
 * @param {string} value - The value to set for the property
 */
function setScriptProperty(key, value) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty(key, value);
    Logger.log(`Script property set: ${key} = ${value}`);
  } catch (error) {
    Logger.log(`Error setting script property "${key}": ${error.message}`);
    // Depending on context, might re-throw or handle
  }
}

/**
 * Checks if the application has been initialized by looking for 'databaseId' script property.
 *
 * @return {boolean} True if 'databaseId' property exists and is non-empty, false otherwise.
 */
function isAppInitialized() {
  const databaseId = getScriptProperty('databaseId');
  return !!databaseId; // True if databaseId is not null, undefined, or empty string
}

/**
 * Initializes the application for first-time use.
 * Creates the database spreadsheet, sets up its structure, and stores its ID.
 *
 * @param {Object} options - Configuration options, e.g., { databaseName: "My Flashcards" }
 * @return {Object} {success: boolean, message: string}
 */
function initializeApp(options = {}) {
  if (isAppInitialized()) {
    Logger.log("Initialization attempt failed: App is already initialized.");
    return { success: false, message: 'Application is already initialized.' };
  }

  try {
    const dbName = options.databaseName || 'Flashcard App Database';
    const db = createDatabaseSpreadsheet(dbName); // From Database.js

    setScriptProperty('databaseId', db.id);

    initializeDatabaseStructure(db.id); // From Database.js
    createSampleDeck(db.id); // From Database.js - creates a 'Sample_Deck'

    // Create a default admin user if not already handled by initializeDatabaseStructure
    // (setupConfigSheet in Database.js already creates a default admin)

    Logger.log(`Application initialized successfully. Database ID: ${db.id}`);
    return { success: true, message: 'Application initialized successfully! Please refresh the page to log in.' };
  } catch (error) {
    Logger.log(`CRITICAL: Error during application initialization: ${error.message}\nStack: ${error.stack}`);
    // Attempt to clean up if partial initialization occurred (e.g., script property set but DB creation failed)
    // For simplicity, we're not doing partial cleanup here, but in a prod app, it might be considered.
    // PropertiesService.getScriptProperties().deleteProperty('databaseId'); // Example cleanup
    return { success: false, message: `Error initializing application: ${error.message}` };
  }
}

// Simple HTML escaping function for use in error messages, etc.
// Could be part of a shared utilities module if more widely needed on server-side.
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return String(str); // Convert non-strings to string representation
  }
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}