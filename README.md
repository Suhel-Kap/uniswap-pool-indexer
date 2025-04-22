# UniSwap Pool Tracker

A TypeScript project that indexes and analyzes Uniswap V2 and V3 liquidity pools to track token launches, identify snipers, calculate market caps, and analyze funding trails.

## Overview

This project uses [Ponder](https://ponder.sh/) to index Ethereum blockchain data for Uniswap V2 and V3 pools. It monitors pool creation events, analyzes transaction patterns, and stores data about tokens, pools, snipers, and funding sources.

## Features

- **Pool Detection**: Monitors UniswapV2Pair:Mint and UniswapV3Pool:Mint events to detect new liquidity pools
- **Token Analysis**: Collects and stores token information including name, symbol, decimals, and total supply
- **Sniper Detection**: Identifies and tracks address behavior that match bot/sniper patterns in the same block as pool creation
- **Team Bundle Analysis**: Detects if pools were created with team bundle patterns (create pool and swap in same transaction)
- **Funding Trail Analysis**: Traces the origin of funds for both pool creators and token deployers up to 3 levels deep
- **Market Cap Calculation**: Calculates initial market cap for newly created pools

## Technical Stack

- TypeScript
- Node.js
- Ponder (Ethereum indexer)
- PostgreSQL (database)
- Viem (Ethereum interaction library)

## Setup

### Prerequisites

- Node.js 16+
- PostgreSQL (optional, SQLite used as fallback)
- Ethereum RPC endpoint (Alchemy recommended)
- Etherscan API key

### Installation

1. Clone the repository
2. Install dependencies:
```bash
bun install
```
3. Set up environment variables:
```bash
cp .env.example .env.local
```

### Environment Variables

```
# Mainnet RPC URL (Alchemy recommended)
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Log level
PONDER_LOG_LEVEL=trace

# PostgreSQL database URL (optional)
DATABASE_URL=postgres://admin:admin@localhost:5432/postgres

# Etherscan API key (required for funding trail analysis)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

## Usage

(Optional) Start the PostgreSQL database:

```bash
docker compose up -d
```

Start the indexer:

```bash
bun dev
```

For production:

```bash
bun start
```

## Architecture

The project consists of several key components:

### Event Handlers

- `UniswapV2Pair:Mint` - Handles Uniswap V2 pool creation events
- `UniswapV3Pool:Mint` - Handles Uniswap V3 pool creation events

### Utility Modules

- `poolUtils.ts` - Functions for pool detection and information retrieval
- `tokenUtils.ts` - Token information gathering and storage
- `sniperUtils.ts` - Bot/sniper detection logic
- `fundingUtils.ts` - Traces funding sources for addresses
- `marketCapUtils.ts` - Market cap calculation logic

### Data Model

The schema includes tables for:

- Pools (both V2 and V3)
- Tokens
- Snipers
- Funding trails
- Contract creation information

## Funding Trail Analysis

The system traces the funding history of addresses by:

1. Starting with the pool creator address
2. Querying Etherscan API to find the first transaction that funded this address
3. Moving up the chain to analyze the funding source
4. Continuing this process up to 3 levels deep

This creates a "money trail" that can help identify connections between different pools and tokens.

## Limitations

- Requires an Etherscan API key for funding analysis
- Rate limited by Etherscan API (uses throttling)
- Only analyzes pools paired with known LP tokens (WETH, USDC, etc.)

## Future Improvements

- Index the entire Ethereum blockchain for historical data instead of relying on Etherscan API
- Create a frontend dashboard for visualizing data