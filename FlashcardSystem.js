/**
 * Load a specific deck
 * 
 * @param {string} deckName - Name of the deck to load
 */
function loadDeck(deckName) {
  if (!deckName) {
    handleError('Deck name is missing');
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      // Defensive null check
      if (!result) {
        handleError('Server returned an empty response');
        hideLoadingIndicator();
        return;
      }
      
      if (result.success) {
        // Store deck data with fallbacks for missing properties
        window.app.currentDeck = deckName;
        window.app.currentCards = result.cards || [];
        window.app.currentCardIndex = 0;
        
        // Show the flashcard view
        displayFlashcardView(result);
      } else {
        if (result.message === 'User not logged in') {
          // Redirect to login for authentication issues
          showLoginForm();
          showError('Please log in to view this deck');
        } else {
          handleError(result.message || 'Unknown error loading deck');
        }
      }
      
      hideLoadingIndicator();
    })
    .withFailureHandler(function(error) {
      handleError('Error loading deck: ' + (error ? error.toString() : 'Unknown error'));
      hideLoadingIndicator();
    })
    .getFlashcardsForDeck(deckName);
}

/**
 * Display the flashcard study view
 * 
 * @param {Object} deckData - The deck data with cards
 */
function displayFlashcardView(deckData) {
  if (!deckData) {
    handleError('No deck data available');
    return;
  }
  
  const contentArea = document.getElementById('appContent');
  if (!contentArea) {
    handleError('Content area not found');
    return;
  }
  
  // Ensure cards array exists
  const cards = deckData.cards || [];
  
  // Filter for due cards
  const dueCards = Array.isArray(cards) ? cards.filter(card => card && card.isDue) : [];
  
  // Check if there are any due cards
  if (dueCards.length === 0) {
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-title">Great job!</div>
        <p>You have no cards due in "${deckData.deckName || 'this deck'}" right now.</p>
        <div class="form-actions" style="margin-top: 20px;">
          <button id="backToDeckList" class="btn">Back to Decks</button>
          <button id="studyAnyway" class="btn btn-outline">Study Anyway</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const backBtn = document.getElementById('backToDeckList');
    if (backBtn) {
      backBtn.addEventListener('click', loadDeckList);
    }
    
    const studyBtn = document.getElementById('studyAnyway');
    if (studyBtn) {
      studyBtn.addEventListener('click', function() {
        if (Array.isArray(cards) && cards.length > 0) {
          displayFlashcard(cards, 0);
        } else {
          handleError('No cards available in this deck');
          loadDeckList();
        }
      });
    }
    
    return;
  }
  
  // Display the first due card
  displayFlashcard(dueCards, 0);
}

/**
 * Display a specific flashcard
 * 
 * @param {Array} cards - Array of cards
 * @param {number} index - Index of the card to display
 */
function displayFlashcard(cards, index) {
  // Validate parameters
  if (!Array.isArray(cards)) {
    handleError('Invalid cards data');
    return;
  }
  
  if (index < 0 || index >= cards.length) {
    // End of deck reached or invalid index
    showDeckComplete();
    return;
  }
  
  const card = cards[index];
  if (!card) {
    handleError('Card data is missing');
    return;
  }
  
  const contentArea = document.getElementById('appContent');
  if (!contentArea) {
    handleError('Content area not found');
    return;
  }
  
  // Process dictionary content in sideC if present
  let sideCContent = card.sideC || '';
  
  contentArea.innerHTML = `
    <div class="flashcard-container">
      <div class="deck-info">
        <h2>${window.app.currentDeck || 'Flashcard Deck'}</h2>
        <div class="progress">Card ${index + 1} of ${cards.length}</div>
      </div>
      
      <div class="flashcard" id="currentCard">
        <div class="flashcard-front">
          <div class="flashcard-content">${card.sideA || 'Question'}</div>
          <div class="flashcard-helper">Click to flip</div>
        </div>
        <div class="flashcard-back">
          <div class="flashcard-content">${card.sideB || 'Answer'}</div>
          <div class="flashcard-secondary">${sideCContent}</div>
        </div>
      </div>
      
      <div class="rating-buttons" style="display: none;" id="ratingButtons">
        <button class="rating-btn rating-btn-again" data-rating="0">
          <span class="material-icons">sentiment_very_dissatisfied</span>
          <span>Again</span>
        </button>
        <button class="rating-btn rating-btn-hard" data-rating="1">
          <span class="material-icons">sentiment_dissatisfied</span>
          <span>Hard</span>
        </button>
        <button class="rating-btn rating-btn-good" data-rating="2">
          <span class="material-icons">sentiment_satisfied</span>
          <span>Good</span>
        </button>
        <button class="rating-btn rating-btn-easy" data-rating="3">
          <span class="material-icons">sentiment_very_satisfied</span>
          <span>Easy</span>
        </button>
      </div>
      
      <div class="flashcard-controls">
        <button id="backToDeckList" class="btn btn-outline">Back to Decks</button>
      </div>
    </div>
  `;
  
  // If card has dictionary content, process it
  if (card.sideC && (card.sideC.includes('[AUDIO:') || card.sideC.includes('[IMAGE:'))) {
    google.script.run
      .withSuccessHandler(function(processedContent) {
        if (processedContent) {
          // Update the card back with processed content
          const secondaryContent = document.querySelector('.flashcard-back .flashcard-secondary');
          if (secondaryContent) {
            secondaryContent.innerHTML = processedContent;
          }
        }
      })
      .withFailureHandler(function(error) {
        // Continue without processed content if there's an error
        console.error('Error processing dictionary content:', error);
      })
      .renderDictionaryContent(card.sideC);
  }
  
  // Add event listeners
  const flashcard = document.getElementById('currentCard');
  if (flashcard) {
    flashcard.addEventListener('click', function() {
      this.classList.toggle('flipped');
      
      // Show rating buttons when card is flipped to back
      const ratingButtons = document.getElementById('ratingButtons');
      if (ratingButtons) {
        ratingButtons.style.display = this.classList.contains('flipped') ? 'flex' : 'none';
      }
    });
  }
  
  // Rating buttons
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      if (e) e.stopPropagation(); // Prevent card from flipping back
      
      const rating = parseInt(this.getAttribute('data-rating') || '0');
      if (card && card.id) {
        rateCard(card.id, rating, cards, index);
      } else {
        handleError('Card data is incomplete');
      }
    });
  });
  
  // Back button
  const backButton = document.getElementById('backToDeckList');
  if (backButton) {
    backButton.addEventListener('click', loadDeckList);
  }
}

/**
 * Rate a flashcard and move to the next one
 * 
 * @param {string} cardId - ID of the card
 * @param {number} rating - Rating value (0-3)
 * @param {Array} cards - Array of cards
 * @param {number} index - Current card index
 */
function rateCard(cardId, rating, cards, index) {
  if (!cardId) {
    handleError('Card ID is missing');
    return;
  }
  
  if (rating < 0 || rating > 3) {
    handleError('Invalid rating value');
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result) {
        handleError('Server returned an empty response when rating card');
        hideLoadingIndicator();
        return;
      }
      
      if (result.success) {
        // Move to the next card
        if (Array.isArray(cards) && index + 1 < cards.length) {
          displayFlashcard(cards, index + 1);
        } else {
          showDeckComplete();
        }
      } else {
        handleError(result.message || 'Failed to record card rating');
        
        // Try to continue anyway to next card
        if (Array.isArray(cards) && index + 1 < cards.length) {
          displayFlashcard(cards, index + 1);
        } else {
          showDeckComplete();
        }
      }
      
      hideLoadingIndicator();
    })
    .withFailureHandler(function(error) {
      handleError('Error rating card: ' + (error ? error.toString() : 'Unknown error'));
      hideLoadingIndicator();
      
      // Try to continue anyway
      if (Array.isArray(cards) && index + 1 < cards.length) {
        displayFlashcard(cards, index + 1);
      } else {
        showDeckComplete();
      }
    })
    .recordCardRating(window.app.currentDeck, cardId, rating);
}

/**
 * Show deck completion screen
 */
function showDeckComplete() {
  const contentArea = document.getElementById('appContent');
  if (!contentArea) {
    handleError('Content area not found');
    return;
  }
  
  contentArea.innerHTML = `
    <div class="card">
      <div class="card-title">Well done!</div>
      <p>You have completed studying this deck.</p>
      <div class="form-actions" style="margin-top: 20px;">
        <button id="backToDeckList" class="btn">Back to Decks</button>
        <button id="restartDeck" class="btn btn-outline">Study Again</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  const backButton = document.getElementById('backToDeckList');
  if (backButton) {
    backButton.addEventListener('click', loadDeckList);
  }
  
  const restartButton = document.getElementById('restartDeck');
  if (restartButton) {
    restartButton.addEventListener('click', function() {
      if (window.app.currentDeck) {
        loadDeck(window.app.currentDeck);
      } else {
        handleError('Current deck information is missing');
        loadDeckList();
      }
    });
  }
}
