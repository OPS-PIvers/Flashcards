/**
 * Creates a new Google Spreadsheet to serve as the database
 * 
 * @param {string} name - Name for the spreadsheet
 * @return {Object} The spreadsheet information
 */
function createDatabaseSpreadsheet(name) {
  const spreadsheet = SpreadsheetApp.create(name);
  const id = spreadsheet.getId();
  const url = spreadsheet.getUrl();
  
  // Add the active user as an editor
  const activeUser = Session.getActiveUser().getEmail();
  DriveApp.getFileById(id).addEditor(activeUser);
  
  return { id, url, spreadsheet };
}

/**
 * Initializes the database structure with required sheets
 * 
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function initializeDatabaseStructure(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  
  // Rename the default sheet to "Config"
  const configSheet = ss.getSheets()[0];
  configSheet.setName('Config');
  
  // Set up Config sheet with user data columns
  setupConfigSheet(configSheet);
  
  // Create Classes sheet
  const classesSheet = ss.insertSheet('Classes');
  setupClassesSheet(classesSheet);
}

/**
 * Sets up the Config sheet with appropriate columns and formatting
 * 
 * @param {Sheet} sheet - The Config sheet object
 */
function setupConfigSheet(sheet) {
  // Set up headers
  const headers = [
    'StudentFirst', 'StudentLast', 'UserName', 'Password', 'IsAdmin', 
    'DateCreated', 'LastLogin', 'PreferredDeck', 'SessionDuration'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format the header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3');
  
  // Add a default admin user
  const adminUser = [
    'Admin', 'User', 'admin', 'password', 'TRUE',
    new Date(), '', '', '30'
  ];
  
  sheet.getRange(2, 1, 1, adminUser.length).setValues([adminUser]);
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Sets up the Classes sheet with appropriate columns and formatting
 * 
 * @param {Sheet} sheet - The Classes sheet object
 */
function setupClassesSheet(sheet) {
  // Set up headers
  const headers = ['ClassName', 'ClassID', 'TeacherUsername', 'StudentUsernames', 'AssignedDecks'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format the header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3');
  
  // Add a sample class
  const sampleClass = [
    'Sample Class', 'class001', 'admin', '[]', '["Sample_Deck"]'
  ];
  
  sheet.getRange(2, 1, 1, sampleClass.length).setValues([sampleClass]);
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Creates a sample flashcard deck
 * 
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function createSampleDeck(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const deckSheet = ss.insertSheet('Sample_Deck');
  
  // Set up headers
  const headers = [
    'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
    'Tags', 'DateCreated', 'CreatedBy'
  ];
  
  deckSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format the header row
  deckSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3');
  
  // Add sample flashcards
  const sampleCards = [
    ['card001', 'What is the capital of France?', 'Paris', '', 'geography,europe', new Date(), 'admin'],
    ['card002', 'What is 2+2?', '4', '', 'math,basics', new Date(), 'admin'],
    ['card003', 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', '', 'literature,classics', new Date(), 'admin'],
    ['card004', 'What is H2O?', 'Water', 'Dihydrogen Monoxide', 'science,chemistry', new Date(), 'admin'],
    ['card005', 'What is the largest planet in our solar system?', 'Jupiter', '', 'science,astronomy', new Date(), 'admin']
  ];
  
  deckSheet.getRange(2, 1, sampleCards.length, headers.length).setValues(sampleCards);
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    deckSheet.autoResizeColumn(i);
  }
}

/**
 * Gets the database spreadsheet
 * 
 * @return {Spreadsheet} The database spreadsheet
 */
function getDatabaseSpreadsheet() {
  const databaseId = getScriptProperty('databaseId');
  if (!databaseId) {
    throw new Error('Database not initialized');
  }
  
  return SpreadsheetApp.openById(databaseId);
}

/**
 * Gets a list of all available decks
 * 
 * @param {boolean} excludeSystemSheets - Whether to exclude system sheets like Config and Classes
 * @return {Object} Result with list of deck names
 */
function getAvailableDecks(excludeSystemSheets = true) {
  try {
    // Check if app is initialized
    if (!isAppInitialized()) {
      return {
        success: false,
        message: 'App not initialized',
        decks: []
      };
    }
    
    const databaseId = getScriptProperty('databaseId');
    let ss;
    
    try {
      ss = SpreadsheetApp.openById(databaseId);
    } catch (e) {
      return {
        success: false,
        message: `Could not open database: ${e.message}`,
        decks: []
      };
    }
    
    if (!ss) {
      return {
        success: false,
        message: 'Database spreadsheet not found',
        decks: []
      };
    }
    
    const sheets = ss.getSheets();
    const systemSheets = ['Config', 'Classes'];
    
    const decks = sheets
      .map(sheet => sheet.getName())
      .filter(name => !excludeSystemSheets || !systemSheets.includes(name));
    
    return {
      success: true,
      decks: decks
    };
  } catch (error) {
    Logger.log(`Error getting available decks: ${error.message}`);
    return { 
      success: false, 
      message: `Error getting available decks: ${error.message}`,
      decks: [] 
    };
  }
}

/**
 * Gets the flashcards from a specific deck
 * 
 * @param {string} deckName - The name of the deck
 * @return {Array} Array of flashcard objects
 */
function getDeckFlashcards(deckName) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(deckName);
  
  if (!sheet) {
    throw new Error(`Deck "${deckName}" not found`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Map column indices
  const colIndexes = {
    id: headers.indexOf('FlashcardID'),
    sideA: headers.indexOf('FlashcardSideA'),
    sideB: headers.indexOf('FlashcardSideB'),
    sideC: headers.indexOf('FlashcardSideC'),
    tags: headers.indexOf('Tags')
  };
  
  // Check if all necessary columns exist
  if (colIndexes.id === -1 || colIndexes.sideA === -1 || colIndexes.sideB === -1) {
    throw new Error(`Deck "${deckName}" does not have the required columns`);
  }
  
  // Process the data and return flashcard objects
  return data.slice(1).map(row => {
    return {
      id: row[colIndexes.id],
      sideA: row[colIndexes.sideA],
      sideB: row[colIndexes.sideB],
      sideC: colIndexes.sideC !== -1 ? row[colIndexes.sideC] : '',
      tags: colIndexes.tags !== -1 ? (row[colIndexes.tags] || '').split(',') : []
    };
  });
}

/**
 * Gets user data from the Config sheet
 * 
 * @param {string} username - Username to look up
 * @return {Object|null} User data or null if not found
 */
function getUserData(username) {
  const ss = getDatabaseSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find username column index
  const usernameIndex = headers.indexOf('UserName');
  
  if (usernameIndex === -1) {
    throw new Error('Username column not found in Config sheet');
  }
  
  // Find the user row
  const userRow = data.slice(1).find(row => row[usernameIndex].toString().toLowerCase() === username.toLowerCase());
  
  if (!userRow) {
    return null;
  }
  
  // Create user object with column mappings
  const user = {};
  headers.forEach((header, index) => {
    user[header] = userRow[index];
  });
  
  return user;
}

/**
 * Updates the last login time for a user
 * 
 * @param {string} username - The username
 */
function updateUserLastLogin(username) {
  const ss = getDatabaseSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find username and LastLogin column indices
  const usernameIndex = headers.indexOf('UserName');
  const lastLoginIndex = headers.indexOf('LastLogin');
  
  if (usernameIndex === -1 || lastLoginIndex === -1) {
    throw new Error('Required columns not found in Config sheet');
  }
  
  // Find the user row
  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameIndex].toString().toLowerCase() === username.toLowerCase()) {
      configSheet.getRange(i + 1, lastLoginIndex + 1).setValue(new Date());
      break;
    }
  }
}

/**
 * Adds a new user to the Config sheet
 * 
 * @param {Object} userData - User data to add
 * @return {boolean} Success indicator
 */
function addUser(userData) {
  const ss = getDatabaseSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Check if username already exists
  const usernameIndex = headers.indexOf('UserName');
  const userExists = data.slice(1).some(row => 
    row[usernameIndex].toString().toLowerCase() === userData.UserName.toLowerCase()
  );
  
  if (userExists) {
    return false;
  }
  
  // Prepare the new user row
  const newRow = headers.map(header => userData[header] || '');
  
  // Set default values
  const dateCreatedIndex = headers.indexOf('DateCreated');
  if (dateCreatedIndex !== -1) {
    newRow[dateCreatedIndex] = new Date();
  }
  
  // Append the new row
  configSheet.appendRow(newRow);
  return true;
}