import {Address} from "viem";
import {Context} from "ponder:registry";
import schema from "ponder:schema";
import {decodeEventLog, Log} from "viem";
import {UniswapV3PoolAbi} from "../../abis/UniswapV3PoolAbi";
import {UniswapV2PairAbi} from "../../abis/UniswapV2PairAbi";
import {PoolTokens, SniperInfo, TrackSnipersEventDataInput, UniswapV2SwapArgs, UniswapV3SwapArgs} from "./types";
import {SWAP_TOPIC_UNISWAP_V2, SWAP_TOPIC_UNISWAP_V3} from "./consts";

export async function trackSnipers(
    context: Context,
    poolAddress: Address,
    poolTokens: PoolTokens,
    eventData: TrackSnipersEventDataInput
): Promise<SniperInfo[]> {
    const {client} = context;
    const isV3: boolean = eventData.isV3 !== undefined ? eventData.isV3 : true;
    const abi = isV3 ? UniswapV3PoolAbi : UniswapV2PairAbi;
    const SWAP_TOPIC = isV3 ? SWAP_TOPIC_UNISWAP_V3 : SWAP_TOPIC_UNISWAP_V2;

    const snipers: Record<string, SniperInfo> = {};

    try {
        const swapLogs = await client.request({
            method: 'eth_getLogs',
            params: [
                {
                    address: poolAddress,
                    topics: [SWAP_TOPIC],
                    fromBlock: `0x${eventData.blockNumber.toString(16)}`,
                    toBlock: `0x${eventData.blockNumber.toString(16)}`
                }
            ]
        }) as Log[];

        const txHashes = [...new Set(swapLogs.map(log => log.transactionHash))];
        const transactions = await Promise.all(
            txHashes.map(hash => client.getTransaction({hash: hash as `0x${string}`}))
        );

        const txSenders: Record<string, Address> = {};
        transactions.forEach(tx => {
            if (tx) txSenders[tx.hash] = tx.from;
        });

        for (const log of swapLogs) {
            const sender: Address | undefined = txSenders[log?.transactionHash!];
            if (!sender) continue;

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
                    ? v2Args.amount0Out
                    : v2Args.amount1Out;
            }

            tokenAmount = tokenAmount > 0 ? tokenAmount : -tokenAmount;

            if (!snipers[sender]) {
                snipers[sender] = {
                    address: sender,
                    volumeBought: 0n,
                    percentSupply: 0,
                    txnHash: log?.transactionHash!
                };
            }
            snipers[sender].volumeBought += tokenAmount;
        }

        return Object.values(snipers).map(sniper => {
            sniper.percentSupply = eventData.totalSupply && eventData.totalSupply > 0n
                ? Number(sniper.volumeBought * 10000n / eventData.totalSupply) / 100
                : 0;
            return sniper;
        });
    } catch (e) {
        console.error("Error processing sniper data:", e);
        return [];
    }
}

export async function saveSnipers(
    context: Context,
    poolId: string,
    snipers: SniperInfo[]
): Promise<void> {
    const {db} = context;

    for (const sniper of snipers) {
        await db.insert(schema.snipers).values({
            poolId: poolId,
            address: sniper.address,
            volumeBought: sniper.volumeBought,
            percentSupply: sniper.percentSupply,
            txnHash: sniper.txnHash
        }).onConflictDoNothing();
    }
}