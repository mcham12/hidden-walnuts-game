# Hidden Walnuts - Quick Reference Guide

## Point Values at a Glance

| Action | Points | Notes |
|--------|--------|-------|
| Find game walnut (buried) | 3 | Hardest, highest reward |
| Find game walnut (bush) | 1 | Easiest |
| Find player walnut (buried) | 2 | Medium difficulty |
| Find player walnut (bush) | 1 | Easy |
| Unfound hidden walnut (end cycle) | 1 | Per walnut bonus |
| First finder (10 finds) | 3 | Once per cycle |
| Tree growth | 20 | Per tree grown |
| Tree milestone (20/40 trees) | 20 | Bonus at intervals |

## Walnut Stats

- **Max inventory**: 10 walnuts
- **Walnut pickup radius**: 1-2 units
- **Growth time**: 60+ seconds unfound
- **Tree walnut drop**: 5 walnuts per grown tree
- **Respawn interval**: 30-120 seconds per tree

## Player Titles & Difficulty

| Title | Score | NPC Aggression | Predator Threat | Status |
|-------|-------|---|---|---|
| Rookie | 0-20 | 0% | 0% | Safe, learning |
| Apprentice | 21-100 | 0% | 0% | Still safe |
| Dabbler | 101-200 | 0% | 40% | Danger begins |
| Slick | 201-300 | 100% | 70% | Moderate difficulty |
| Maestro | 301-500 | 115% | 90% | Challenging |
| Ninja | 501-1000 | 125% | 110% | Hard |
| Legend | 1001+ | 135% | 130% | Hardest |

## Health & Combat

- **Starting health**: 100 HP
- **Projectile damage**: 10 HP per hit
- **Wildebeest bite**: 30 HP per hit
- **Health healing**: 10 HP per walnut eaten
- **Respawn health**: Full 100 HP
- **Respawn location**: Forest center (0, 2, 0)
- **Respawn invulnerability**: 2 seconds

## Predators

### Wildebeest (Ground)
- Speed: 5.5 units/sec
- Attack range: 1.5 units
- Damage: 30 HP
- Attack cooldown: 8 seconds
- Defense mechanic: 4 hits to flee (no health)
- Vision: 30 units

### Cardinal/Toucan (Aerial)
- Speed: 6.5 units/sec
- Attack type: Steals 1-2 walnuts
- Attack cooldown: 45 seconds
- Cruise height: 2.5 units
- Vision: 30 units

### Predator Spawning
- **Max active**: 2
- **Spawn chance**: 40% per 15-second check
- **Min spawn interval**: 90 seconds
- **Max lifetime**: 5 minutes
- **Despawn trigger**: >100 units from center

## Chat & Emotes

- **Chat rate limit**: 5 messages per 10 seconds
- **Emote rate limit**: 5 per 10 seconds (shared with chat)
- **Broadcast**: All players receive

## Multiplayer Sync

- **Position updates**: 20 per second
- **NPC updates**: 5 per second (cost-optimized)
- **Predator updates**: 10 per second
- **Interpolation delay**: 150ms
- **Chat/emotes**: Immediate

## Game Cycles

- **Daily cycle**: 24 hours (reset 8:00 AM UTC)
- **Weekly leaderboard**: Sunday reset 8:05 AM UTC
- **Session persistence**: Indefinite (stored on server)

## Score Multiplier

- **Base**: 1.0x
- **Max**: 2.0x
- **Increment**: Every 5 minutes active play
- **Time to max**: ~50 minutes
- **Reset**: Daily with cycle

## Leaderboard Rules

### Daily
- Scope: Current 24-hour cycle
- Eligibility: All players
- Reset: Daily at 8:00 AM UTC

### Weekly
- Scope: Current 7-day week
- Reset: Sunday 8:05 AM UTC
- Top 10: Authenticated players only
- Others: All players eligible

### All-Time
- Scope: Lifetime
- Eligibility: Authenticated players only
- Reset: Never

## Characters

### Guest (No Auth)
- Squirrel (1 char)

### Free Authentication
- Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard (6 chars)

### Premium ($1.99 each)
- Lynx, Bear, Moose, Badger (4 chars)

## Movement & Physics

- **Max speed**: 5.0 units/sec
- **Acceleration**: 20 units/sec²
- **Deceleration**: 15 units/sec²
- **World bounds**: ±100 units (X, Z)
- **Height bounds**: -5 to 50 units (Y)
- **Collision radius**: 0.3 units
- **Projectile max range**: 15 units

## Bot Protection

- **Required token**: Cloudflare Turnstile
- **Testing token**: XXXX.* (dev/preview)
- **Rate limit**: 5 connections per 5 minutes per IP
- **Verification**: Server-side validation

## NPC System

- **Spawn count**: ~2 based on player population
- **Max health**: 100 HP
- **Behaviors**: Idle, wander, gather, throw, eat, rest
- **Respawn after death**: 30 seconds
- **Targeting**: Based on proximity + player rank

## Position Persistence

Saved on disconnect:
- X, Y, Z coordinates
- Rotation (facing direction)
- Health (HP)
- Inventory (walnut count)
- Score
- Player title
- Session state

## Anti-Cheat Rules

- **Max score increase**: 100 points per minute
- **Absolute max score**: 100,000 points
- **Speed validation**: Server checks movement feasibility
- **Teleport detection**: Rejects jumps >10 units
- **Range validation**: Projectiles must be <15 units
- **Rate limiting**: Detects impossible gains

## Session Types

| Type | Auth | Characters | Devices | Duration |
|------|------|---|---|---|
| Guest | No | 1 (squirrel) | 1 | Until cleared |
| Free Auth | Yes | 6 free | Multiple | Persistent |
| Premium Auth | Yes | 6 free + 4 paid | Multiple | Persistent |

