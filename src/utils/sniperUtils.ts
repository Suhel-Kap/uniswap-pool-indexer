import {Address, TransactionReceipt} from "viem";
import { Context } from "ponder:registry";
import schema from "ponder:schema";
import { decodeEventLog, Log, Transaction } from "viem";
import { filterTransactionsForAddress } from "./events";
import { UniswapV3PoolAbi } from "../../abis/UniswapV3PoolAbi";
import { SWAP_TOPIC } from "./consts";
import { UniswapV2PairAbi } from "../../abis/UniswapV2PairAbi";
import {PoolTokens, SniperInfo, TrackSnipersEventDataInput, UniswapV2SwapArgs, UniswapV3SwapArgs} from "./types";

export async function trackSnipers(
    context: Context,
    poolAddress: Address,
    poolTokens: PoolTokens,
    eventData: TrackSnipersEventDataInput
): Promise<SniperInfo[]> {
    const { client } = context;
    const isV3: boolean = eventData.isV3 !== undefined ? eventData.isV3 : true;
    const abi = isV3 ? UniswapV3PoolAbi : UniswapV2PairAbi;

    const blockTransactions: Array<Transaction> = await filterTransactionsForAddress(context, poolAddress, {
        blockNumber: eventData.blockNumber,
        transactionIndex: eventData.txIndex
    });

    const snipers: SniperInfo[] = [];

    try {
        for (const tx of blockTransactions) {
            const txReceipt: TransactionReceipt = await client.getTransactionReceipt({ hash: tx.hash });
            console.log("Transaction receipt sniperTxns:", txReceipt);

            const sniperSwapLogs: Array<Log> = txReceipt.logs.filter((log: Log) =>
                log.address.toLowerCase() === poolAddress.toLowerCase() &&
                log.topics[0] === SWAP_TOPIC
            );
            console.log("Sniper swap logs:", sniperSwapLogs);

            if (sniperSwapLogs.length > 0) {
                let sniperVolume = 0n;

                for (const log of sniperSwapLogs) {
                    const decodedLog = decodeEventLog({
                        abi: abi,
                        eventName: "Swap",
                        topics: log.topics as [Address, ...Address[]],
                        data: log.data
                    });

                    let tokenAmount: bigint = 0n;

                    if (isV3) {
                        const v3Args = decodedLog.args as UniswapV3SwapArgs;
                        tokenAmount = poolTokens.tokenIsToken0
                            ? v3Args.amount0
                            : v3Args.amount1;
                    } else {
                        const v2Args = decodedLog.args as UniswapV2SwapArgs;
                        tokenAmount = poolTokens.tokenIsToken0
                            ? v2Args.amount0In - v2Args.amount0Out
                            : v2Args.amount1In - v2Args.amount1Out;
                    }

                    sniperVolume += tokenAmount > 0 ? tokenAmount : -tokenAmount;
                }

                const percentSupply = eventData.totalSupply && eventData.totalSupply > 0n
                    ? Number(sniperVolume * 10000n / eventData.totalSupply) / 100
                    : 0;

                snipers.push({
                    address: tx.from,
                    volumeBought: sniperVolume,
                    percentSupply
                });
            }
        }
    } catch (e) {
        console.error("Error processing sniper data:", e);
    }

    return snipers;
}

export async function saveSnipers(
    context: Context,
    poolId: string,
    snipers: SniperInfo[]
): Promise<void> {
    const { db } = context;

    for (const sniper of snipers) {
        await db.insert(schema.snipers).values({
            poolId: poolId,
            address: sniper.address,
            volumeBought: sniper.volumeBought,
            percentSupply: sniper.percentSupply
        }).onConflictDoNothing();
    }
}