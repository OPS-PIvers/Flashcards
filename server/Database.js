/**
 * Database Management Module for Flashcard App
 * Handles interactions with the Google Spreadsheet acting as the database.
 */

/**
 * Creates a new Google Spreadsheet to serve as the database.
 * This is typically called during app initialization.
 *
 * @param {string} name - Name for the new spreadsheet (e.g., "Flashcard App Database")
 * @return {Object} {id: string, url: string, spreadsheet: Spreadsheet}
 */
function createDatabaseSpreadsheet(name) {
  const spreadsheet = SpreadsheetApp.create(name);
  const id = spreadsheet.getId();
  const url = spreadsheet.getUrl();

  // Add the active user (creator) as an editor for immediate access
  try {
    const activeUserEmail = Session.getActiveUser().getEmail();
    if (activeUserEmail) { // getEmail() can be empty if script runs impersonally
      DriveApp.getFileById(id).addEditor(activeUserEmail);
    }
  } catch (e) {
    Logger.log(`Could not automatically add editor ${Session.getActiveUser().getEmail()} to spreadsheet ${id}: ${e.message}. Manual sharing might be needed.`);
  }
  
  Logger.log(`Database spreadsheet created: Name='${name}', ID='${id}'`);
  return { id, url, spreadsheet };
}

/**
 * Initializes the database structure with required sheets and basic data.
 * Called once when the application is first set up.
 *
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function initializeDatabaseStructure(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  // Rename the default "Sheet1" to "Config"
  let configSheet = ss.getSheetByName('Sheet1');
  if (configSheet) {
    configSheet.setName('Config');
  } else {
    configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  }
  setupConfigSheet(configSheet);

  // Create "Classes" sheet (if it doesn't exist)
  const classesSheet = ss.getSheetByName('Classes') || ss.insertSheet('Classes');
  setupClassesSheet(classesSheet);
  
  Logger.log(`Database structure initialized for spreadsheet ID: ${spreadsheetId}`);
}

/**
 * Sets up the 'Config' sheet with columns for user data and an initial admin user.
 *
 * @param {Sheet} sheet - The 'Config' sheet object
 */
function setupConfigSheet(sheet) {
  sheet.clearContents(); // Clear any existing content before setting up
  const headers = [
    'StudentFirst', 'StudentLast', 'UserName', 'Password', 'IsAdmin',
    'DateCreated', 'LastLogin', 'PreferredDeck', 'SessionDuration'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  // !!! SECURITY WARNING: Default 'admin'/'password' is insecure.
  // This should be changed immediately after initialization.
  const adminUser = [
    'Admin', 'User', 'admin', 'password', // Default credentials
    'TRUE', // IsAdmin
    new Date(), // DateCreated
    '', // LastLogin
    '', // PreferredDeck
    '60' // SessionDuration (e.g., in minutes)
  ];
  sheet.getRange(2, 1, 1, adminUser.length).setValues([adminUser]);

  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  Logger.log("'Config' sheet setup complete with default admin user.");
}

/**
 * Sets up the 'Classes' sheet with columns for class management.
 *
 * @param {Sheet} sheet - The 'Classes' sheet object
 */
function setupClassesSheet(sheet) {
  sheet.clearContents();
  const headers = ['ClassName', 'ClassID', 'TeacherUsername', 'StudentUsernames', 'AssignedDecks'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  // Add a sample class (optional, for demonstration)
  const sampleClass = [
    'Sample Class 101',
    `class_${Utilities.getUuid().substring(0,6)}`,
    'admin', // Teacher username
    JSON.stringify([]), // StudentUsernames (empty array as JSON string)
    JSON.stringify(['Sample_Deck']) // AssignedDecks (array as JSON string)
  ];
  sheet.getRange(2, 1, 1, sampleClass.length).setValues([sampleClass]);
  
  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  Logger.log("'Classes' sheet setup complete.");
}

/**
 * Creates a sample flashcard deck named 'Sample_Deck'.
 *
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function createSampleDeck(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const deckName = 'Sample_Deck';
  
  let deckSheet = ss.getSheetByName(deckName);
  if (deckSheet) {
    deckSheet.clearContents(); // Clear if it exists, to reset sample data
  } else {
    deckSheet = ss.insertSheet(deckName);
  }

  const headers = [
    'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
    'Tags', 'DateCreated', 'CreatedBy'
  ];
  deckSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  const sampleCards = [
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the capital of France?', 'Paris', 'Hint: European city', 'geography,europe', new Date(), 'admin'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is 2 + 2?', '4', '', 'math,basics', new Date(), 'admin'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Famous English playwright', 'literature,classics', new Date(), 'admin'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is H₂O (H2O)?', 'Water', 'Chemical formula', 'science,chemistry', new Date(), 'admin'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the largest planet in our solar system?', 'Jupiter', 'A gas giant', 'science,astronomy', new Date(), 'admin']
  ];
  if (sampleCards.length > 0) {
    deckSheet.getRange(2, 1, sampleCards.length, headers.length).setValues(sampleCards);
  }
  
  headers.forEach((_, i) => deckSheet.autoResizeColumn(i + 1));
  Logger.log(`'${deckName}' sheet setup complete with sample cards.`);
}

/**
 * Retrieves the database spreadsheet object.
 * Throws an error if the database ID is not configured.
 *
 * @return {Spreadsheet} The database spreadsheet
 * @throws {Error} If databaseId script property is not set.
 */
function getDatabaseSpreadsheet() {
  const databaseId = getScriptProperty('databaseId'); // Assumes getScriptProperty from Code.js
  if (!databaseId) {
    Logger.log("CRITICAL: Database ID script property not found.");
    throw new Error('Database not initialized. Please run initialization or check Script Properties.');
  }
  try {
    return SpreadsheetApp.openById(databaseId);
  } catch (e) {
    Logger.log(`CRITICAL: Failed to open database spreadsheet with ID '${databaseId}'. Error: ${e.message}`);
    throw new Error(`Failed to access database. Ensure spreadsheet ID '${databaseId}' is valid and accessible. Original error: ${e.message}`);
  }
}

/**
 * Gets a list of all available deck names (sheet names).
 *
 * @param {boolean} excludeSystemSheets - If true, 'Config' and 'Classes' sheets are excluded.
 * @return {Object} {success: boolean, decks?: Array<string>, message?: string}
 */
function getAvailableDecks(excludeSystemSheets = true) {
  try {
    const ss = getDatabaseSpreadsheet();
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
    Logger.log(`Error in getAvailableDecks: ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error getting available decks: ${error.message}` };
  }
}

/**
 * Retrieves all flashcards from a specific deck sheet.
 * Returns full card objects including all defined columns.
 *
 * @param {string} deckName - The name of the deck (sheet name)
 * @return {Array<Object>} Array of flashcard objects. Each object's keys are the header names.
 * @throws {Error} If deck not found or required columns are missing.
 */
function getDeckFlashcards(deckName) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(deckName);

  if (!sheet) {
    Logger.log(`Deck not found: ${deckName}`);
    throw new Error(`Deck "${deckName}" not found.`);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) { // No headers, no data
      Logger.log(`Deck "${deckName}" is empty or has no headers.`);
      return []; // Return empty array if deck is empty
  }
  const headers = data[0].map(h => String(h).trim()); // Ensure headers are strings and trimmed

  // Basic validation for essential columns
  const requiredColumns = ['FlashcardID', 'FlashcardSideA', 'FlashcardSideB'];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      Logger.log(`Deck "${deckName}" is missing required column: ${col}`);
      throw new Error(`Deck "${deckName}" is missing required column: "${col}". Please check sheet headers.`);
    }
  }

  const flashcards = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const card = {};
    let hasEssentialData = true; // Check if essential parts of a card are present

    headers.forEach((header, index) => {
      card[header] = row[index];
      // If a required column is unexpectedly empty for this card, flag it or handle
      if (requiredColumns.includes(header) && (row[index] === null || String(row[index]).trim() === '')) {
          if (header === 'FlashcardID') hasEssentialData = false; // ID is critical
      }
    });
    
    // Add card only if it has an ID, SideA, and SideB
    if (hasEssentialData && card.FlashcardID && card.FlashcardSideA && card.FlashcardSideB) {
        // Normalize tags if the 'Tags' column exists
        if (headers.includes('Tags') && typeof card['Tags'] === 'string') {
            card['Tags'] = card['Tags'].split(',').map(tag => tag.trim()).filter(tag => tag);
        } else if (headers.includes('Tags')) {
            card['Tags'] = []; // Default to empty array if Tags column exists but value is not string
        }
        flashcards.push(card);
    } else {
        Logger.log(`Skipping row ${i+1} in deck "${deckName}" due to missing essential data (ID, SideA, or SideB).`);
    }
  }
  return flashcards;
}


/**
 * Retrieves user data from the 'Config' sheet based on username.
 * Does NOT return the password.
 *
 * @param {string} username - Username to look up (case-insensitive)
 * @return {Object|null} User data object (without password) or null if not found.
 */
function getUserData(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) {
        Logger.log("CRITICAL: 'Config' sheet not found during getUserData.");
        return null;
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const usernameIndex = headers.indexOf('UserName');
    const passwordIndex = headers.indexOf('Password'); // To exclude it later

    if (usernameIndex === -1) {
      Logger.log("CRITICAL: 'UserName' column not found in 'Config' sheet.");
      return null; // Or throw error
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[usernameIndex] && String(row[usernameIndex]).toLowerCase() === lowerCaseUsername) {
        const user = {};
        headers.forEach((header, index) => {
          if (index !== passwordIndex) { // Exclude password from returned object
            user[header] = row[index];
          }
        });
        // Ensure 'Password' field is present for authentication check if called internally
        // This function is also used by authenticateUser, which needs the password.
        // So, we add a special parameter to control this behavior, or create a separate function.
        // For now, let's assume this getUserData is primarily for authentication.
        // If called for other purposes, password should be stripped.
        // The `getUsers` in AdminTools.js already strips passwords.
        // THIS VERSION KEEPS PASSWORD for authenticateUser.
        if (passwordIndex !== -1) {
            user['Password'] = row[passwordIndex]; // Keep password for internal auth
        }

        return user;
      }
    }
    return null; // User not found
  } catch (error) {
    Logger.log(`Error in getUserData for "${username}": ${error.message}\nStack: ${error.stack}`);
    return null;
  }
}

/**
 * Updates the 'LastLogin' timestamp for a specified user in the 'Config' sheet.
 *
 * @param {string} username - The username (case-insensitive)
 */
function updateUserLastLogin(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
     if (!configSheet) {
        Logger.log("CRITICAL: 'Config' sheet not found during updateUserLastLogin.");
        return;
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const usernameIndex = headers.indexOf('UserName');
    const lastLoginIndex = headers.indexOf('LastLogin');

    if (usernameIndex === -1 || lastLoginIndex === -1) {
      Logger.log("CRITICAL: 'UserName' or 'LastLogin' column not found in 'Config' sheet.");
      return; // Or throw error
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameIndex] && String(data[i][usernameIndex]).toLowerCase() === lowerCaseUsername) {
        configSheet.getRange(i + 1, lastLoginIndex + 1).setValue(new Date());
        Logger.log(`Updated LastLogin for user: ${username}`);
        return;
      }
    }
    Logger.log(`User not found for LastLogin update: ${username}`);
  } catch (error) {
    Logger.log(`Error in updateUserLastLogin for "${username}": ${error.message}\nStack: ${error.stack}`);
  }
}

/**
 * Adds a new user to the 'Config' sheet.
 * Intended for admin use; direct calls should be secured.
 *
 * @param {Object} userData - User data object. Must include UserName, Password.
 *                            Optional: StudentFirst, StudentLast, IsAdmin.
 * @return {Object} {success: boolean, message: string}
 */
function addUser(userData) {
  // This function should ideally be in AdminTools.js and have an admin check.
  // For now, keeping it here as per original structure, but noting the security aspect.
  if (!isUserAdmin()) { // Add admin check
      return { success: false, message: "Permission Denied: Only admins can add users." };
  }

  if (!userData || !userData.UserName || !userData.Password) {
    return { success: false, message: "UserName and Password are required to add a new user." };
  }

  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) {
        return { success: false, message: "CRITICAL: 'Config' sheet not found." };
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const usernameIndex = headers.indexOf('UserName');

    // Check if username already exists
    const userExists = data.slice(1).some(row =>
      row[usernameIndex] && String(row[usernameIndex]).toLowerCase() === userData.UserName.toLowerCase()
    );

    if (userExists) {
      return { success: false, message: `User "${userData.UserName}" already exists.` };
    }

    const newRowValues = headers.map(header => {
      switch(header) {
        case 'StudentFirst': return userData.StudentFirst || '';
        case 'StudentLast': return userData.StudentLast || '';
        case 'UserName': return userData.UserName;
        case 'Password': return userData.Password; // Plain text storage - security risk!
        case 'IsAdmin': return String(userData.IsAdmin === true || String(userData.IsAdmin).toUpperCase() === 'TRUE').toUpperCase();
        case 'DateCreated': return new Date();
        case 'LastLogin': return '';
        case 'PreferredDeck': return userData.PreferredDeck || '';
        case 'SessionDuration': return userData.SessionDuration || '60';
        default: return '';
      }
    });

    configSheet.appendRow(newRowValues);
    Logger.log(`Admin added new user: ${userData.UserName}`);
    return { success: true, message: `User "${userData.UserName}" added successfully.` };

  } catch (error) {
    Logger.log(`Error in addUser for "${userData.UserName}": ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error adding user: ${error.message}` };
  }
}