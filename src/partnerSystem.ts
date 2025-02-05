import { World, PlayerEntity } from 'hytopia';
import { playerNickname } from './state';

// Partner System State
// Maps player IDs to their partner's ID (bidirectional pairing)
let playerPartners: Record<number, number> = {};
// Maps target player IDs to requesting player IDs for pending partner requests
let pendingPartnerRequests: Record<number, number> = {};

// Type definitions for partner-related messages
interface PartnerRequest {
    type: 'requestPartner';    // Message type for requesting a partnership
    targetId: number;          // ID of the player being requested
}

interface PartnerResponse {
    type: 'respondToPartnerRequest';  // Message type for responding to a partner request
    accepted: boolean;                // Whether the request was accepted or rejected
}

// Union type for all possible partner-related messages
type PartnerMessage = PartnerRequest | PartnerResponse | {
    type: 'lockPointer';  // Message type for locking the mouse pointer in the game
};

// Public Functions -------------------------------------------------------

/**
 * Main message handler for all partner-related actions
 * @param world The game world instance
 * @param playerEntity The player entity sending the message
 * @param data The message data
 */
export function handlePartnerRequest(world: World, playerEntity: PlayerEntity, data: PartnerMessage) {
    if (!playerEntity?.id) return;  // Exit if player entity is invalid
    const playerId = playerEntity.id;

    // Route message to appropriate handler based on message type
    switch(data.type) {
        case 'requestPartner':
            processPartnerRequest(world, playerEntity, data.targetId);
            break;
        case 'respondToPartnerRequest':
            processPartnerResponse(world, playerEntity, data.accepted);
            break;
        case 'lockPointer':
            playerEntity.player.ui.lockPointer(true);  // Lock mouse pointer to game window
            break;
    }
}

/**
 * Sets up the UI for players to select partners
 * @param world The game world instance
 * @param queuedPlayers Set of players waiting to select partners
 */
export function initializePartnerSelection(world: World, queuedPlayers: Set<PlayerEntity>) {
    // Clear existing partnerships before starting new selection
    resetPartnerships();
    
    queuedPlayers.forEach(entity => {
        if (!entity.id) return;
        
        // Unlock mouse pointer for partner selection UI
        entity.player.ui.lockPointer(false);
        
        // Create list of available players (excluding self and those with partners)
        const availablePlayers = Array.from(queuedPlayers)
            .filter(p => p.id !== entity.id && !hasPartner(p.id!))
            .map(p => ({
                id: p.id,
                name: playerNickname[p.id!]
            }));
        
        // Send available players list to client UI
        entity.player.ui.sendData({
            type: 'partnerSelection',
            availablePlayers
        });
    });
}

/**
 * Resets all partnership data to initial state
 * Logs state before and after reset for debugging
 */
export function resetPartnerships() {
    playerPartners = {};
    pendingPartnerRequests = {};
}

/**
 * Returns a copy of current partnerships
 */
export function getPartnerships(): Record<number, number> {
    return {...playerPartners};
}

/**
 * Checks if a player has an active partnership
 * @param playerId The ID of player to check
 */
export function hasPartner(playerId: number): boolean {
    if (typeof playerId !== 'number') {
        return false;
    }
    return playerId in playerPartners && typeof playerPartners[playerId] === 'number';
}

/**
 * Gets the partner ID for a given player
 * Includes validation and error correction for broken partnerships
 * @param playerId The ID of player to get partner for
 */
export function getPartnerId(playerId: number): number | null {
    const partnerId = playerPartners[playerId] || null;
    
    // Fix broken partnerships where bidirectional relationship is missing
    if (partnerId !== null && playerPartners[partnerId] !== playerId) {
        playerPartners[partnerId] = playerId;
    }
    
    return partnerId;
}

/**
 * Removes partnership for both players
 * @param playerId ID of either player in the partnership
 */
export function removePartnership(playerId: number) {
    const partnerId = playerPartners[playerId];
    if (partnerId) {
        delete playerPartners[playerId];
        delete playerPartners[partnerId];
    }
}

/**
 * Cleanup function for when a player leaves
 * @param playerId ID of the leaving player
 */
export function cleanupPlayerPartnerships(playerId: number) {
    removePartnership(playerId);
}

// Private Helper Functions --------------------------------------------------

/**
 * Handles incoming partner requests
 * Validates target availability and notifies target player
 */
function processPartnerRequest(world: World, requester: PlayerEntity, targetId: number) {
    const requesterId = requester.id!;
    
    // Check if target player is already partnered or has pending request
    if (playerPartners[targetId] || pendingPartnerRequests[targetId]) {
        requester.player.ui.sendData({
            type: 'partnerRequestFailed',
            message: 'Player is not available'
        });
        return;
    }

    // Store the pending request
    pendingPartnerRequests[targetId] = requesterId;

    // Find and notify target player
    const targetEntity = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === targetId);
        
    if (targetEntity) {
        targetEntity.player.ui.sendData({
            type: 'partnerRequest',
            fromId: requesterId,
            fromName: playerNickname[requesterId]
        });
    }
}

/**
 * Handles responses to partner requests
 * Creates partnership if accepted, notifies rejection if declined
 */
function processPartnerResponse(world: World, responder: PlayerEntity, accepted: boolean) {
    const responderId = responder.id!;
    const requesterId = pendingPartnerRequests[responderId];
    
    if (!requesterId) return; // Exit if no pending request exists
    
    delete pendingPartnerRequests[responderId];

    if (accepted) {
        createPartnership(world, responderId, requesterId);
    } else {
        notifyRejection(world, responder, requesterId);
    }
}

/**
 * Creates a new partnership between two players
 * Ensures clean state and notifies both players
 */
function createPartnership(world: World, player1Id: number, player2Id: number) {
    // Clear any existing partnerships
    removePartnership(player1Id);
    removePartnership(player2Id);
    
    // Create bidirectional partnership
    playerPartners[player1Id] = player2Id;
    playerPartners[player2Id] = player1Id;
    
    
    // Find both player entities
    const player1 = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === player1Id);
    const player2 = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === player2Id);

    if (!player1 || !player2) {
        return;
    }

    // Notify both players of successful partnership
    const confirmationMessage = {
        type: 'partnershipFormed',
        player1: playerNickname[player1Id],
        player2: playerNickname[player2Id]
    };
    
    player1.player.ui.sendData(confirmationMessage);
    player2.player.ui.sendData(confirmationMessage);
}

/**
 * Notifies requesting player that their request was rejected
 */
function notifyRejection(world: World, responder: PlayerEntity, requesterId: number) {
    const requesterEntity = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === requesterId);
        
    if (requesterEntity) {
        requesterEntity.player.ui.sendData({
            type: 'partnerRequestRejected',
            playerName: playerNickname[responder.id!]
        });
    }
}