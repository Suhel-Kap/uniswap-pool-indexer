import {ponder} from "ponder:registry";
import schema from "ponder:schema";
import {Address} from "viem";
import {uniswapV3Mutex, uniswapV2Mutex} from "./utils/consts";
import {eq} from "ponder";
import {checkIfTeamBundle, getOrCreatePool, getPoolTokens, updatePoolWithAdditionalLiquidity} from "./utils/poolUtils";
import {getContractCreationInfo, getOrCreateToken, getTargetTokenInfo} from "./utils/tokenUtils";
import {saveSnipers, trackSnipers} from "./utils/sniperUtils";
import {calculateMarketCap, saveMarketCap} from "./utils/marketCapUtils";
import {processPoolFunding} from "./utils/fundingUtils";
import {storeLpTokens} from "./utils/storeNewContracts";
import {ContractCreationInfo, PoolTokens, SniperInfo, TokenInfo} from "./utils/types";

// This function can be invoked on either UniswapV2Pair:setup or UniswapV3Pair:setup events as it only inserts the LP token in the DB
ponder.on("UniswapV2Pair:setup", async ({context}) => {
    await storeLpTokens(context);
})

ponder.on("UniswapV2Pair:Mint", async ({event, context}) => {
    await uniswapV2Mutex.runExclusive(async () => {
        try {
            const poolAddress: Address = event.log.address;
            console.log("UniswapV2Pair:Mint event found for pool:", poolAddress);

            const existingPool = await context.db.sql.query.pools.findFirst({
                where: eq(schema.pools.poolAddress, poolAddress)
            });

            const poolTokens: PoolTokens | null = await getPoolTokens(context, poolAddress, false);
            if (!poolTokens) {
                console.log("No relevant LP token found in pool, skipping...");
                return;
            }

            const tokenInfo: TokenInfo = await getTargetTokenInfo(context, poolTokens.targetToken);

            const lpAmount: bigint = poolTokens.tokenIsToken0 ? event.args.amount1 : event.args.amount0;
            const tokenAmount: bigint = poolTokens.tokenIsToken0 ? event.args.amount0 : event.args.amount1;

            if (existingPool) {
                if (existingPool.creationBlock < event.block.number) {
                    return;
                }

                if (existingPool.creationBlock === event.block.number) {
                    await updatePoolWithAdditionalLiquidity(context, existingPool, poolAddress, poolTokens, tokenInfo, lpAmount, tokenAmount);
                    return
                }
            }

            const tokenCreationInfo: ContractCreationInfo | null = await getContractCreationInfo(poolTokens.targetToken);
            const tokenId: string = await getOrCreateToken(context, tokenInfo, tokenCreationInfo);
            const isTeamBundle: boolean = await checkIfTeamBundle(context, poolAddress, event.transaction.hash, false);

            const poolId: string = await getOrCreatePool(
                context,
                poolAddress,
                tokenId,
                poolTokens,
                {
                    blockNumber: event.block.number,
                    timestamp: event.block.timestamp,
                    txHash: event.transaction.hash,
                    txIndex: event.transaction.transactionIndex,
                    lpAmount: lpAmount,
                    teamBundle: isTeamBundle,
                    isV3: false,
                    deployerAddress: event.transaction.from
                }
            );

            const snipers: Array<SniperInfo> = await trackSnipers(
                context,
                poolAddress,
                poolTokens,
                {
                    blockNumber: event.block.number,
                    txIndex: event.transaction.transactionIndex,
                    totalSupply: tokenInfo.totalSupply,
                    isV3: false
                }
            );
            await saveSnipers(context, poolId, snipers);

            if (tokenInfo.totalSupply) {
                const marketCap: bigint = calculateMarketCap({
                    tokenTotalSupply: tokenInfo.totalSupply,
                    tokenAmount: poolTokens.tokenIsToken0 ? event.args.amount0 : event.args.amount1,
                    tokenDecimals: tokenInfo.decimals,
                    lpTokenAmount: lpAmount,
                    lpTokenDecimals: poolTokens.lpTokenDecimals,
                });

                await saveMarketCap(context, poolId, {
                    lpTokenAddress: poolTokens.lpToken,
                    lpTokenSymbol: poolTokens.lpSymbol,
                    marketCap: marketCap
                });
            }

            await processPoolFunding(
                context,
                event.transaction.from,
                poolAddress,
                poolId
            );

            console.log(`Successfully processed V2 pool ${poolAddress} with token ${poolTokens.targetToken}`);
            console.log(`Team bundle: ${isTeamBundle}, Snipers: ${snipers.length}`);
        } catch (error) {
            console.error("Error processing UniswapV2Pair:Mint event:", error);
        }
    });
});

ponder.on("UniswapV3Pool:Mint", async ({event, context}) => {
    await uniswapV3Mutex.runExclusive(async () => {
        try {
            const poolAddress: Address = event.log.address;
            console.log("UniswapV3Pool:Mint event found for pool:", poolAddress);

            const existingPool = await context.db.sql.query.pools.findFirst({
                where: eq(schema.pools.poolAddress, poolAddress)
            });

            const poolTokens: PoolTokens | null = await getPoolTokens(context, poolAddress);
            if (!poolTokens) {
                console.log("No relevant LP token found in pool, skipping...");
                return;
            }

            const tokenInfo: TokenInfo = await getTargetTokenInfo(context, poolTokens.targetToken);

            const lpAmount: bigint = poolTokens.tokenIsToken0 ? event.args.amount1 : event.args.amount0;
            const tokenAmount: bigint = poolTokens.tokenIsToken0 ? event.args.amount0 : event.args.amount1;

            if (existingPool) {
                if (existingPool.creationBlock < event.block.number) {
                    return;
                }

                if (existingPool.creationBlock === event.block.number) {
                    await updatePoolWithAdditionalLiquidity(context, existingPool, poolAddress, poolTokens, tokenInfo, lpAmount, tokenAmount);
                    return
                }
            }

            const tokenCreationInfo: ContractCreationInfo | null = await getContractCreationInfo(poolTokens.targetToken);
            const tokenId: string = await getOrCreateToken(context, tokenInfo, tokenCreationInfo);
            const isTeamBundle: boolean = await checkIfTeamBundle(context, poolAddress, event.transaction.hash, true);

            const poolId: string = await getOrCreatePool(
                context,
                poolAddress,
                tokenId,
                poolTokens,
                {
                    blockNumber: event.block.number,
                    timestamp: event.block.timestamp,
                    txHash: event.transaction.hash,
                    txIndex: event.transaction.transactionIndex,
                    lpAmount: lpAmount,
                    teamBundle: isTeamBundle,
                    isV3: true,
                    deployerAddress: event.transaction.from
                }
            );

            const snipers: Array<SniperInfo> = await trackSnipers(
                context,
                poolAddress,
                poolTokens,
                {
                    blockNumber: event.block.number,
                    txIndex: event.transaction.transactionIndex,
                    totalSupply: tokenInfo.totalSupply,
                    isV3: true,
                }
            );

            await saveSnipers(context, poolId, snipers);

            if (tokenInfo.totalSupply) {
                const marketCap: bigint = calculateMarketCap({
                    tokenTotalSupply: tokenInfo.totalSupply,
                    tokenAmount: poolTokens.tokenIsToken0 ? event.args.amount0 : event.args.amount1,
                    tokenDecimals: tokenInfo.decimals,
                    lpTokenAmount: lpAmount,
                    lpTokenDecimals: poolTokens.lpTokenDecimals,
                })

                await saveMarketCap(context, poolId, {
                    lpTokenAddress: poolTokens.lpToken,
                    lpTokenSymbol: poolTokens.lpSymbol,
                    marketCap: marketCap
                });
            }

            await processPoolFunding(
                context,
                event.transaction.from,
                poolAddress,
                poolId
            );

            console.log(`Successfully processed pool ${poolAddress} with token ${poolTokens.targetToken}`);
            console.log(`Team bundle: ${isTeamBundle}, Snipers: ${snipers.length}`);
        } catch (error) {
            console.error("Error processing UniswapV3Pool:Mint event:", error);
        }
    });
});