import {Address} from "viem";

export interface FundingInfo {
    level: number;
    funderAddress: Address;
    fundingAddress: Address;
    amount: bigint;
    txHash: string;
    timestamp: number;
}

export interface EtherscanTx {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    isError: string;
}

export interface GetMarketCapInput {
    marketCap: bigint;
    lpTokenAddress: Address;
    lpTokenSymbol: string;
}

export interface PoolTokens {
    token0: Address;
    token1: Address;
    targetToken: Address;
    lpToken: Address;
    lpSymbol: string;
    lpTokenDecimals: number;
    tokenIsToken0: boolean;
}

export interface GetOrCreatePoolInput {
    blockNumber: bigint;
    timestamp: bigint;
    txHash: string;
    txIndex: number;
    lpAmount: bigint;
    teamBundle: boolean;
    isV3: boolean;
    deployerAddress: Address;
}

export interface SniperInfo {
    address: Address;
    volumeBought: bigint;
    percentSupply: number;
    txnHash: Address;
}

export interface UniswapV3SwapArgs {
    sender: Address;
    recipient: Address;
    amount0: bigint;
    amount1: bigint;
    sqrtPriceX96: bigint;
    liquidity: bigint;
    tick: number;
}

export interface UniswapV2SwapArgs {
    sender: Address;
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
    to: Address;
}

export interface TrackSnipersEventDataInput {
    blockNumber: bigint;
    txIndex: number;
    totalSupply: bigint | null;
    isV3?: boolean;
}

export interface TokenInfo {
    address: Address;
    name: string;
    ticker: string;
    decimals: number;
    totalSupply: bigint | null;
}

export interface ContractCreationInfo {
    contractAddress: Address;
    contractCreator: Address;
    txHash: Address;
    blockNumber: bigint;
    timestamp: bigint;
}

export interface CalculateMarketCapInput {
    lpTokenAmount: bigint;
    lpTokenDecimals: number;
    tokenAmount: bigint;
    tokenDecimals: number;
    tokenTotalSupply: bigint;
}