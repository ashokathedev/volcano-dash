import { World, PlayerEntity } from 'hytopia';

// Partner System State
let playerPartners: Record<number, number> = {};
let pendingPartnerRequests: Record<number, number> = {};

// Message Types for Type Safety
interface PartnerRequest {
    type: 'requestPartner';
    targetId: number;
}

interface PartnerResponse {
    type: 'respondToPartnerRequest';
    accepted: boolean;
}

type PartnerMessage = PartnerRequest | PartnerResponse;

// Public Functions -------------------------------------------------------

// Handle incoming partner-related messages
export function handlePartnerRequest(world: World, playerEntity: PlayerEntity, data: PartnerMessage) {
    if (!playerEntity?.id) return;
    const playerId = playerEntity.id;

    switch(data.type) {
        case 'requestPartner':
            processPartnerRequest(world, playerEntity, data.targetId);
            break;
        case 'respondToPartnerRequest':
            processPartnerResponse(world, playerEntity, data.accepted);
            break;
    }
}

// Initialize partner selection UI for queued players
export function initializePartnerSelection(world: World, queuedPlayers: Set<PlayerEntity>) {
    resetPartnerships();
    
    queuedPlayers.forEach(entity => {
        if (!entity.id) return;
        
        const availablePlayers = Array.from(queuedPlayers)
            .filter(p => p.id !== entity.id)
            .map(p => ({
                id: p.id,
                name: p.player.username
            }));
        
        entity.player.ui.sendData({
            type: 'partnerSelection',
            availablePlayers
        });
    });
}

// Reset partnership data
export function resetPartnerships() {
    playerPartners = {};
    pendingPartnerRequests = {};
}

// Get current partnerships
export function getPartnerships(): Record<number, number> {
    return {...playerPartners};
}

// Check if player has partner
export function hasPartner(playerId: number): boolean {
    return playerId in playerPartners;
}

// Get partner's ID
export function getPartnerId(playerId: number): number | null {
    return playerPartners[playerId] || null;
}

// Remove a partnership
export function removePartnership(playerId: number) {
    const partnerId = playerPartners[playerId];
    if (partnerId) {
        delete playerPartners[playerId];
        delete playerPartners[partnerId];
    }
}

// Remove a player's partnership data
export function cleanupPlayerPartnerships(playerId: number) {
    removePartnership(playerId);
}

// Private Helper Functions --------------------------------------------------

function processPartnerRequest(world: World, requester: PlayerEntity, targetId: number) {
    const requesterId = requester.id!;
    
    // Validate target is available
    if (playerPartners[targetId] || pendingPartnerRequests[targetId]) {
        requester.player.ui.sendData({
            type: 'partnerRequestFailed',
            message: 'Player is not available'
        });
        return;
    }

    // Store pending request
    pendingPartnerRequests[targetId] = requesterId;

    // Notify target player
    const targetEntity = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === targetId);
        
    if (targetEntity) {
        targetEntity.player.ui.sendData({
            type: 'partnerRequest',
            fromId: requesterId,
            fromName: requester.player.username
        });
    }
}

function processPartnerResponse(world: World, responder: PlayerEntity, accepted: boolean) {
    const responderId = responder.id!;
    const requesterId = pendingPartnerRequests[responderId];
    
    if (!requesterId) return; // No pending request
    
    delete pendingPartnerRequests[responderId];

    if (accepted) {
        createPartnership(world, responderId, requesterId);
    } else {
        notifyRejection(world, responder, requesterId);
    }
}

function createPartnership(world: World, player1Id: number, player2Id: number) {
    playerPartners[player1Id] = player2Id;
    playerPartners[player2Id] = player1Id;

    const player1 = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === player1Id);
    const player2 = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === player2Id);

    if (player1 && player2) {
        const confirmMessage = {
            type: 'partnershipFormed',
            player1: player1.player.username,
            player2: player2.player.username
        };
        
        player1.player.ui.sendData(confirmMessage);
        player2.player.ui.sendData(confirmMessage);
    }
}

function notifyRejection(world: World, responder: PlayerEntity, requesterId: number) {
    const requesterEntity = world.entityManager.getAllPlayerEntities()
        .find(p => p.id === requesterId);
        
    if (requesterEntity) {
        requesterEntity.player.ui.sendData({
            type: 'partnerRequestRejected',
            playerName: responder.player.username
        });
    }
}

// Helper functions
function notifyPlayers(player1: PlayerEntity, player2: PlayerEntity, message: any) {
    // ... notification logic ...
} 