import {Address, Log, TransactionReceipt} from "viem";
import {LP_TOKENS, SWAP_TOPIC_UNISWAP_V2, SWAP_TOPIC_UNISWAP_V3} from "./consts";
import schema from "ponder:schema";
import {UniswapV3PoolAbi} from "../../abis/UniswapV3PoolAbi";
import {UniswapV2PairAbi} from "../../abis/UniswapV2PairAbi";
import {Context} from "ponder:registry";
import {eq} from "ponder";
import {GetOrCreatePoolInput, PoolTokens, TokenInfo} from "./types";
import {calculateMarketCap} from "./marketCapUtils";

export async function getPoolTokens(
    context: Context,
    poolAddress: Address,
    isV3: boolean = true
): Promise<PoolTokens | null> {
    try {
        const {client} = context;
        const abi = isV3 ? UniswapV3PoolAbi : UniswapV2PairAbi;
        const poolContract = {
            address: poolAddress,
            abi: abi,
        } as const;

        const tokenInfo = await client.multicall({
            contracts: [
                {...poolContract, functionName: "token0"},
                {...poolContract, functionName: "token1"}
            ]
        });

        if (tokenInfo[0].error || tokenInfo[1].error) {
            console.error("Error fetching token addresses:", tokenInfo[0].error, tokenInfo[1].error);
            return null;
        }

        const token0Address = tokenInfo[0].result as Address;
        const token1Address = tokenInfo[1].result as Address;

        const lpTokenAddresses: Array<string> = Object.values(LP_TOKENS).map(token => token.address.toLowerCase());

        if (lpTokenAddresses.includes(token0Address.toLowerCase())) {
            const lpInfo = Object.entries(LP_TOKENS).find(
                ([_, token]) => token.address.toLowerCase() === token0Address.toLowerCase()
            );

            return {
                token0: token0Address,
                token1: token1Address,
                targetToken: token1Address,
                lpToken: token0Address,
                lpSymbol: lpInfo?.[0] || "UNKNOWN",
                lpTokenDecimals: lpInfo?.[1].decimals || 18,
                tokenIsToken0: false
            } as PoolTokens;
        } else if (lpTokenAddresses.includes(token1Address.toLowerCase())) {
            const lpInfo = Object.entries(LP_TOKENS).find(
                ([_, token]) => token.address.toLowerCase() === token1Address.toLowerCase()
            );

            return {
                token0: token0Address,
                token1: token1Address,
                targetToken: token0Address,
                lpToken: token1Address,
                lpSymbol: lpInfo?.[0] || "UNKNOWN",
                lpTokenDecimals: lpInfo?.[1].decimals || 18,
                tokenIsToken0: true
            } as PoolTokens;
        }

        return null;
    } catch (e) {
        console.error(`Error getting pool tokens for ${poolAddress}:`, e);
        return null;
    }
}

export async function checkIfTeamBundle(
    context: Context,
    poolAddress: Address,
    txHash: Address,
    isV3: boolean
): Promise<boolean> {
    try {
        const receipt: TransactionReceipt = await context.client.getTransactionReceipt({
            hash: txHash,
        });

        return receipt.logs.some((log: Log) =>
            log.address.toLowerCase() === poolAddress.toLowerCase() &&
            log.topics[0] === (isV3 ? SWAP_TOPIC_UNISWAP_V3 : SWAP_TOPIC_UNISWAP_V2)
        );
    } catch (e) {
        console.error(`Error checking for team bundle in tx ${txHash}:`, e);
        return false;
    }
}

export async function getOrCreatePool(
    context: Context,
    poolAddress: Address,
    tokenId: string,
    poolTokens: PoolTokens,
    eventData: GetOrCreatePoolInput
): Promise<string> {
    const {db} = context;

    await db.insert(schema.pools).values({
        tokenId: tokenId,
        pairedWithAddress: poolTokens.lpToken,
        pairedWithSymbol: poolTokens.lpSymbol,
        poolAddress: poolAddress,
        tokenIsToken0: poolTokens.tokenIsToken0,
        creationBlock: eventData.blockNumber,
        launchTimestamp: eventData.timestamp,
        creationTxnHash: eventData.txHash as Address,
        creationTxnIndex: eventData.txIndex,
        lpType: eventData.isV3 ? schema.lpType.enumValues[1] : schema.lpType.enumValues[0], // UNISWAP_V3 or V2
        initialLiquidity: eventData.lpAmount,
        teamBundle: eventData.teamBundle,
        deployerAddress: eventData.deployerAddress
    }).onConflictDoUpdate({
        creationBlock: eventData.blockNumber,
        launchTimestamp: eventData.timestamp,
        creationTxnHash: eventData.txHash as Address,
        initialLiquidity: eventData.lpAmount,
        teamBundle: eventData.teamBundle
    });

    const poolResult = await db.sql.select({
        id: schema.pools.id
    }).from(schema.pools).where(eq(schema.pools.poolAddress, poolAddress));

    return poolResult[0]?.id!;
}

export async function updatePoolWithAdditionalLiquidity(
    context: Context,
    existingPool: any,
    poolAddress: Address,
    poolTokens: PoolTokens,
    tokenInfo: TokenInfo,
    additionalLpAmount: bigint,
    tokenAmount: bigint
): Promise<void> {
    const { db } = context;

    const newLpAmount = existingPool.lpAmount + additionalLpAmount;

    await db.sql.update(schema.pools).set({
        initialLiquidity: newLpAmount
    }).where(eq(schema.pools.id, existingPool.id));

    console.log(`Updated pool ${poolAddress} with additional LP: ${additionalLpAmount.toString()}`);

    if (tokenInfo.totalSupply) {
        const newMarketCap: bigint = calculateMarketCap({
            tokenTotalSupply: tokenInfo.totalSupply,
            tokenAmount: tokenAmount,
            tokenDecimals: tokenInfo.decimals,
            lpTokenAmount: newLpAmount,
            lpTokenDecimals: poolTokens.lpTokenDecimals,
        });

        const marketCapEntry = await db.sql.query.marketCaps.findFirst({
            where: eq(schema.marketCaps.poolId, existingPool.id)
        });

        if (marketCapEntry) {
            await db.sql.update(schema.marketCaps).set({
                marketCap: newMarketCap
            }).where(eq(schema.marketCaps.id, marketCapEntry.id));

            console.log(`Updated market cap for pool ${poolAddress}: ${newMarketCap.toString()}`);
        }
    }
}