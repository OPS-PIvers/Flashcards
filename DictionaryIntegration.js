/**
 * Dictionary integration UI functionality
 */
function initDictionaryLookup() {
  // Add event listener to lookup button
  const lookupBtn = document.getElementById('lookupWordBtn');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', lookupWord);
  } else {
    console.error('Dictionary lookup button not found');
  }
  
  // Add event listener to word input for Enter key
  const wordInput = document.getElementById('dictionaryWord');
  if (wordInput) {
    wordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        lookupWord();
      }
    });
  }
  
  // Populate deck dropdown
  populateDeckDropdown();
  
  // Add event listener to deck dropdown
  const deckDropdown = document.getElementById('targetDeck');
  if (deckDropdown) {
    deckDropdown.addEventListener('change', loadCardsForDeck);
  }
  
  // Add event listener to add to deck button
  const addToDeckBtn = document.getElementById('addToDeckBtn');
  if (addToDeckBtn) {
    addToDeckBtn.addEventListener('click', addContentToCard);
  }
}

/**
 * Look up a word in the dictionary
 */
function lookupWord() {
  const wordInput = document.getElementById('dictionaryWord');
  if (!wordInput) {
    handleError('Word input not found');
    return;
  }
  
  const word = wordInput.value.trim();
  
  if (!word) {
    showError('Please enter a word to look up');
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoadingIndicator();
      
      if (!result) {
        handleError('Server returned an empty response');
        return;
      }
      
      if (result.success) {
        displayDictionaryResults(result);
      } else {
        handleError(result.message || 'Dictionary lookup failed');
      }
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Error looking up word: ' + (error ? error.toString() : 'Unknown error'));
    })
    .previewDictionaryContent(word);
}

/**
 * Display dictionary lookup results
 * 
 * @param {Object} result - Dictionary lookup result
 */
function displayDictionaryResults(result) {
  if (!result) {
    handleError('Missing dictionary results');
    return;
  }
  
  // Get the results area
  const resultsArea = document.getElementById('dictionaryResults');
  if (!resultsArea) {
    handleError('Dictionary results area not found');
    return;
  }
  
  // Show results area
  resultsArea.style.display = 'block';
  
  // Find elements to update
  const wordElement = document.getElementById('resultWord');
  const pronunciationArea = document.getElementById('pronunciationResult');
  const illustrationArea = document.getElementById('illustrationResult');
  
  if (!wordElement || !pronunciationArea || !illustrationArea) {
    handleError('Dictionary result elements not found');
    return;
  }
  
  // Set word
  wordElement.textContent = result.word || 'Unknown word';
  
  // Display pronunciation
  if (result.audioUrl) {
    pronunciationArea.innerHTML = `
      <audio controls>
        <source src="${result.audioUrl}" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
    `;
  } else {
    pronunciationArea.innerHTML = '<p>No pronunciation available</p>';
  }
  
  // Display illustration
  if (result.imageUrl) {
    illustrationArea.innerHTML = `
      <img src="${result.imageUrl}" alt="Illustration of ${result.word}" style="max-width: 100%; height: auto;">
    `;
  } else {
    illustrationArea.innerHTML = '<p>No illustration available</p>';
  }
  
  // Store word data for later use
  window.currentDictionaryWord = result.word;
}

/**
 * Populate the deck dropdown
 */
function populateDeckDropdown() {
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoadingIndicator();
      
      if (!result) {
        handleError('Server returned an empty response');
        return;
      }
      
      if (!result.success) {
        handleError(result.message || 'Failed to retrieve decks');
        return;
      }
      
      const deckDropdown = document.getElementById('targetDeck');
      if (!deckDropdown) {
        handleError('Deck dropdown not found');
        return;
      }
      
      deckDropdown.innerHTML = '<option value="">Select a deck...</option>';
      
      // Ensure decks is an array
      if (!Array.isArray(result.decks)) {
        handleError('Invalid deck data received');
        return;
      }
      
      // Filter out system sheets
      const systemSheets = ['Config', 'Classes'];
      const userDecks = result.decks.filter(deck => !systemSheets.includes(deck));
      
      userDecks.forEach(deckName => {
        if (deckName) {
          const option = document.createElement('option');
          option.value = deckName;
          option.textContent = deckName;
          deckDropdown.appendChild(option);
        }
      });
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Error loading decks: ' + (error ? error.toString() : 'Unknown error'));
    })
    .getAvailableDecks(false);
}

/**
 * Load cards for the selected deck
 */
function loadCardsForDeck() {
  const deckDropdown = document.getElementById('targetDeck');
  if (!deckDropdown) {
    handleError('Deck dropdown not found');
    return;
  }
  
  const selectedDeck = deckDropdown.value;
  const cardSelectionArea = document.getElementById('cardSelectionArea');
  
  if (!cardSelectionArea) {
    handleError('Card selection area not found');
    return;
  }
  
  if (!selectedDeck) {
    cardSelectionArea.style.display = 'none';
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoadingIndicator();
      
      if (!result) {
        handleError('Server returned an empty response');
        return;
      }
      
      if (!result.success) {
        handleError(result.message || 'Failed to load cards');
        return;
      }
      
      const cardDropdown = document.getElementById('targetCard');
      if (!cardDropdown) {
        handleError('Card dropdown not found');
        return;
      }
      
      cardDropdown.innerHTML = '<option value="">Select a card...</option>';
      
      // Ensure cards is an array
      const cards = Array.isArray(result.cards) ? result.cards : [];
      
      cards.forEach(card => {
        if (card && card.id && card.sideA) {
          const option = document.createElement('option');
          option.value = card.id;
          option.textContent = card.sideA;
          cardDropdown.appendChild(option);
        }
      });
      
      cardSelectionArea.style.display = 'block';
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Error loading cards: ' + (error ? error.toString() : 'Unknown error'));
    })
    .getFlashcardsForDeck(selectedDeck);
}

/**
 * Add dictionary content to the selected card
 */
function addContentToCard() {
  const deckDropdown = document.getElementById('targetDeck');
  const cardDropdown = document.getElementById('targetCard');
  
  if (!deckDropdown || !cardDropdown) {
    handleError('Deck or card dropdown not found');
    return;
  }
  
  const selectedDeck = deckDropdown.value;
  const selectedCard = cardDropdown.value;
  const word = window.currentDictionaryWord;
  
  if (!selectedDeck) {
    showError('Please select a deck');
    return;
  }
  
  if (!selectedCard) {
    showError('Please select a card');
    return;
  }
  
  if (!word) {
    showError('No word data available');
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoadingIndicator();
      
      if (!result) {
        handleError('Server returned an empty response');
        return;
      }
      
      if (result.success) {
        showSuccess('Dictionary content added to card');
      } else {
        showError(result.message || 'Failed to add dictionary content');
      }
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Error adding dictionary content: ' + (error ? error.toString() : 'Unknown error'));
    })
    .addDictionaryContentToCard(selectedDeck, selectedCard, word);
}