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
    if (activeUserEmail) {
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

  let configSheet = ss.getSheetByName('Sheet1');
  if (configSheet) {
    configSheet.setName('Config');
  } else {
    configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  }
  setupConfigSheet(configSheet);

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
  sheet.clearContents();
  // PHASE 1 MODIFICATION: Updated headers to reflect a more realistic user config
  const headers = [
    'StudentFirst', 'StudentLast', 'UserName', 'Password',
    'IsAdmin', 'DateCreated', 'LastLogin', 'PreferredDeck', 'SessionDuration'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  const adminUser = [
    'Admin', 'User', 'admin', 'password',
    true, // IsAdmin
    new Date(), // DateCreated
    '', // LastLogin
    '', // PreferredDeck
    '60' // SessionDuration
  ];
  sheet.getRange(2, 1, 1, adminUser.length).setValues([adminUser]);
  // Ensure 'IsAdmin' column is formatted as checkbox for new rows if possible (manual step or advanced script)
  // For now, it will be TRUE/FALSE text. Checkbox needs specific handling if default is desired.
  // Example: var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  // sheet.getRange("E2:E").setDataValidation(rule); // If E is IsAdmin column

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

  const sampleClass = [
    'Sample Class 101',
    `class_${Utilities.getUuid().substring(0,6)}`,
    'admin',
    JSON.stringify([]),
    JSON.stringify(['Sample_Deck'])
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
    deckSheet.clearContents();
  } else {
    deckSheet = ss.insertSheet(deckName);
  }

  const headers = [
    'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
    'Tags', 'DateCreated', 'CreatedBy', 'StudyConfig' // Added StudyConfig
  ];
  deckSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  const sampleCards = [
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the capital of France?', 'Paris', 'Hint: European city', 'geography,europe', new Date(), 'admin', '{"showSideB":true, "showSideC":true, "autoplayAudio":false}'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is 2 + 2?', '4', '', 'math,basics', new Date(), 'admin', '{"showSideB":true, "showSideC":false, "autoplayAudio":false}'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Famous English playwright\n[AUDIO:sample_audio_url_if_any]', 'literature,classics', new Date(), 'admin', '{"showSideB":true, "showSideC":true, "autoplayAudio":true}'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is H₂O (H2O)?', '[IMAGE:sample_image_url_if_any]\nWater', 'Chemical formula', 'science,chemistry', new Date(), 'admin', '{"showSideB":true, "showSideC":true, "autoplayAudio":false}'],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the largest planet in our solar system?', 'Jupiter', 'A gas giant', 'science,astronomy', new Date(), 'admin', 'true'] // Example of non-JSON StudyConfig
  ];
  if (sampleCards.length > 0) {
    // Ensure sampleCards array matches the number of headers
    const cardsToInsert = sampleCards.map(card => card.length >= headers.length ? card : [...card, ...Array(headers.length - card.length).fill('')]);
    deckSheet.getRange(2, 1, cardsToInsert.length, headers.length).setValues(cardsToInsert);
  }

  headers.forEach((_, i) => deckSheet.autoResizeColumn(i + 1));
  Logger.log(`'${deckName}' sheet setup complete with sample cards and StudyConfig.`);
}

/**
 * Retrieves the database spreadsheet object.
 * Throws an error if the database ID is not configured.
 *
 * @return {Spreadsheet} The database spreadsheet
 * @throws {Error} If databaseId script property is not set.
 */
function getDatabaseSpreadsheet() {
  const databaseId = getScriptProperty('databaseId');
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
 * Ensures all returned values are JSON-serializable primitives or arrays of primitives.
 *
 * @param {string} deckName - The name of the deck (sheet name)
 * @return {Array<Object>} Array of flashcard objects. Each object's keys are the header names.
 * @throws {Error} If deck not found or required columns are missing.
 */
function getDeckFlashcards(deckName) {
  Logger.log(`Database.js: getDeckFlashcards - Processing deck: ${deckName}`); // PHASE 1 LOGGING
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(deckName);

  if (!sheet) {
    Logger.log(`Database.js: getDeckFlashcards - Deck not found: ${deckName}`);
    throw new Error(`Deck "${deckName}" not found.`);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) {
      Logger.log(`Database.js: getDeckFlashcards - Deck "${deckName}" is empty or has no headers.`);
      return [];
  }
  const headers = data[0].map(h => String(h).trim());
  Logger.log(`Database.js: getDeckFlashcards - Headers for ${deckName}: ${JSON.stringify(headers)}`); // PHASE 1 LOGGING

  const requiredColumns = ['FlashcardID', 'FlashcardSideA', 'FlashcardSideB']; // Keep StudyConfig optional here, handle in FlashcardSystem
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      Logger.log(`Database.js: getDeckFlashcards - Deck "${deckName}" is missing required column: ${col}`);
      throw new Error(`Deck "${deckName}" is missing required column: "${col}". Please check sheet headers.`);
    }
  }

  const flashcards = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const card = {};
    let hasEssentialData = false; // Start as false, set to true if ID is present

    headers.forEach((header, index) => {
      let value = row[index];
      if (value instanceof Date) {
        card[header] = value.toISOString();
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
        card[header] = value;
      } else {
        card[header] = value != null ? String(value) : null;
      }

      if (header === 'FlashcardID' && card[header] && String(card[header]).trim() !== '') {
          hasEssentialData = true;
      }
    });

    // Also ensure SideA and SideB are present for a card to be considered valid
    if (hasEssentialData && card.FlashcardSideA && card.FlashcardSideB) {
        if (headers.includes('Tags') && typeof card['Tags'] === 'string') {
            card['Tags'] = card['Tags'].split(',').map(tag => tag.trim()).filter(tag => tag);
        } else if (headers.includes('Tags')) {
            card['Tags'] = Array.isArray(card['Tags']) ? card['Tags'].map(String) : [];
        }
        // Ensure StudyConfig is passed as a string if it exists, or null/undefined otherwise
        if (headers.includes('StudyConfig')) {
            card['StudyConfig'] = (card['StudyConfig'] === null || typeof card['StudyConfig'] === 'undefined') ? null : String(card['StudyConfig']);
        } else {
            card['StudyConfig'] = null; // Explicitly null if column doesn't exist
        }

        flashcards.push(card);
    } else {
        Logger.log(`Database.js: getDeckFlashcards - Skipping row ${i+1} in deck "${deckName}" due to missing FlashcardID, FlashcardSideA, or FlashcardSideB. Card data (raw from sheet): ${JSON.stringify(row.slice(0, headers.length))}`);
    }
  }
  // PHASE 1 LOGGING: Log a sample of the cards being returned
  if (flashcards.length > 0) {
    Logger.log(`Database.js: getDeckFlashcards - Raw card data from sheet for ${deckName} (first 3 or fewer): ${JSON.stringify(flashcards.slice(0, 3))}`);
  } else {
    Logger.log(`Database.js: getDeckFlashcards - No valid cards found in ${deckName} after processing rows.`);
  }
  return flashcards;
}


/**
 * Retrieves user data from the 'Config' sheet based on username.
 *
 * @param {string} username - Username to look up (case-insensitive)
 * @return {Object|null} User data object or null if not found. Includes Password for authentication.
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
    const isAdminIndex = headers.indexOf('IsAdmin');

    Logger.log(`Database.js: getUserData - Looking for user "${username}". Headers: ${JSON.stringify(headers)}. UserName index: ${usernameIndex}, IsAdmin index: ${isAdminIndex}`);

    if (usernameIndex === -1) {
      Logger.log("CRITICAL: 'UserName' column not found in 'Config' sheet.");
      return null;
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[usernameIndex] && String(row[usernameIndex]).toLowerCase() === lowerCaseUsername) {
        let isAdminValue = false; // Default to false

        if (isAdminIndex !== -1) {
          const isAdminCell = configSheet.getRange(i + 1, isAdminIndex + 1); // Sheet rows are 1-indexed
          const cellValue = isAdminCell.getValue();
          let isCheckedByMethod = null;
          try {
            isCheckedByMethod = isAdminCell.isChecked(); // This is the most reliable for checkboxes
          } catch (e) {
            Logger.log(`Database.js: getUserData - isAdminCell.isChecked() failed for ${username} at ${isAdminCell.getA1Notation()}: ${e.message}. Value was: ${cellValue}`);
          }

          if (isCheckedByMethod === true) {
            isAdminValue = true;
          } else if (isCheckedByMethod === false) {
            isAdminValue = false;
          } else { // Fallback if isChecked() is null (not a checkbox) or failed
            isAdminValue = cellValue === true || String(cellValue).toUpperCase() === 'TRUE';
          }
          Logger.log(`Database.js: getUserData - User: ${username}, IsAdmin raw cell value: ${cellValue} (type: ${typeof cellValue}), isChecked(): ${isCheckedByMethod}, final isAdminValue: ${isAdminValue}`);
        } else {
            Logger.log(`Database.js: getUserData - IsAdmin column not found for user ${username}. Defaulting IsAdmin to false.`);
        }

        const user = {};
        headers.forEach((header, index) => {
            if (header === 'IsAdmin') {
              user[header] = isAdminValue;
            } else {
              let value = row[index];
              if (value instanceof Date) {
                  user[header] = value.toISOString();
              } else {
                  user[header] = value;
              }
            }
        });
        Logger.log(`Database.js: getUserData - Found user: ${username}, Data: ${JSON.stringify(user)}`);
        return user;
      }
    }
    Logger.log(`Database.js: getUserData - User not found: ${username}`);
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
      return;
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
        case 'Password': return userData.Password;
        case 'IsAdmin': return userData.IsAdmin === true || String(userData.IsAdmin).toUpperCase() === 'TRUE'; // Store as boolean
        case 'DateCreated': return new Date();
        case 'LastLogin': return '';
        case 'PreferredDeck': return userData.PreferredDeck || '';
        case 'SessionDuration': return userData.SessionDuration || '60';
        default: return '';
      }
    });

    configSheet.appendRow(newRowValues);
    Logger.log(`New user added: ${userData.UserName}`);
    return { success: true, message: `User "${userData.UserName}" added successfully.` };

  } catch (error) {
    Logger.log(`Error in addUser for "${userData.UserName}": ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error adding user: ${error.message}` };
  }
}


function getIsUserAdmin(username) {
  // PHASE 1 MODIFICATION: Enhanced logging within this critical function
  Logger.log(`Database.js: getIsUserAdmin - Checking admin status for: ${username}`);
  try {
    if (!username || typeof username !== 'string') {
      Logger.log("Database.js: getIsUserAdmin - Invalid username parameter (null, undefined, or not a string). Returning false.");
      return false;
    }

    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');

    if (!configSheet) {
      Logger.log("Database.js: getIsUserAdmin - Config sheet not found. Returning false.");
      return false;
    }

    const data = configSheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log("Database.js: getIsUserAdmin - Config sheet has no data or only headers. Returning false.");
      return false;
    }

    const headers = data[0].map(h => String(h).trim());
    Logger.log("Database.js: getIsUserAdmin - Config sheet headers: " + JSON.stringify(headers));

    let usernameIndex = headers.indexOf('UserName');
    let isAdminIndex = headers.indexOf('IsAdmin');

    Logger.log(`Database.js: getIsUserAdmin - Determined column indices - UserName: ${usernameIndex}, IsAdmin: ${isAdminIndex}`);

    if (usernameIndex === -1) {
      Logger.log("Database.js: getIsUserAdmin - UserName column not found in Config sheet. Returning false.");
      return false;
    }

    if (isAdminIndex === -1) {
      Logger.log("Database.js: getIsUserAdmin - IsAdmin column not found in Config sheet.");
      if (username.toLowerCase() === 'admin') {
        Logger.log("Database.js: getIsUserAdmin - IsAdmin column missing, but user is 'admin'. Defaulting to TRUE for 'admin'.");
        return true; // Special fallback for 'admin' user if IsAdmin column is missing
      }
      Logger.log("Database.js: getIsUserAdmin - IsAdmin column missing and user is not 'admin'. Returning false.");
      return false;
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentUsernameInSheet = String(row[usernameIndex] || "").toLowerCase();

      if (currentUsernameInSheet === lowerCaseUsername) {
        Logger.log(`Database.js: getIsUserAdmin - Found user '${username}' at sheet row ${i + 1}.`);
        const isAdminRawValueFromSheet = row[isAdminIndex];
        const isAdminCell = configSheet.getRange(i + 1, isAdminIndex + 1); // Sheet rows are 1-indexed
        let isCheckedByMethod = null;
        let isAdminCellValue = isAdminCell.getValue(); // Get direct cell value

        try {
          // isChecked() is the most reliable for actual checkboxes
          isCheckedByMethod = isAdminCell.isChecked();
          Logger.log(`Database.js: getIsUserAdmin - For user '${username}', isAdminCell.isChecked() result: ${isCheckedByMethod} (Cell A1: ${isAdminCell.getA1Notation()})`);
        } catch (e) {
          // This might happen if the cell isn't a checkbox or there's an issue with the method.
          Logger.log(`Database.js: getIsUserAdmin - isAdminCell.isChecked() failed for user '${username}': ${e.message}. Raw value: ${isAdminRawValueFromSheet}, Cell value: ${isAdminCellValue}`);
        }

        // Determine admin status based on checkbox state first, then cell value
        let determinedAdminStatus;
        if (isCheckedByMethod === true) {
          determinedAdminStatus = true;
        } else if (isCheckedByMethod === false) {
          determinedAdminStatus = false;
        } else {
          // Fallback if isChecked() is null (e.g., not a checkbox, or error)
          // Check the direct cell value (TRUE/FALSE string or boolean true/false)
          determinedAdminStatus = isAdminCellValue === true || String(isAdminCellValue).toUpperCase() === 'TRUE';
          Logger.log(`Database.js: getIsUserAdmin - For user '${username}', fell back to cell value check. Cell value: ${isAdminCellValue}, Result: ${determinedAdminStatus}`);
        }
        Logger.log(`Database.js: getIsUserAdmin - Final admin status for '${username}': ${determinedAdminStatus}. Raw sheet value: ${isAdminRawValueFromSheet}, Direct cell value: ${isAdminCellValue}, isChecked(): ${isCheckedByMethod}`);
        return determinedAdminStatus;
      }
    }

    Logger.log(`Database.js: getIsUserAdmin - User "${username}" not found in Config sheet after iterating. Returning false.`);
    return false;
  } catch (error) {
    Logger.log(`Database.js: getIsUserAdmin - Error checking admin status for "${username}": ${error.message}\nStack: ${error.stack}. Returning false.`);
    return false;
  }
}