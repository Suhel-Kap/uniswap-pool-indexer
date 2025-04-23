import {Address} from "viem";
import {Context} from "ponder:registry";
import schema from "ponder:schema";
import axios from "axios";
import {EtherscanTx, FundingInfo} from "./types";

/**
 * Traces the funding addresses for a given address to specified levels
 */
export async function trackFundingHistory(
    deployerAddress: Address,
    levels: number = 3
): Promise<FundingInfo[]> {
    const fundingChain: FundingInfo[] = [];
    let currentAddress = deployerAddress.toLowerCase();
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!apiKey) {
        console.error("ETHERSCAN_API_KEY not found in environment variables");
        return [];
    }

    for (let level = 1; level <= levels; level++) {
        try {
            const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${currentAddress}&startblock=0&endblock=99999999&page=1&offset=5&sort=asc&apikey=${apiKey}`;

            const response = await axios.get(url);

            // Check if the API call was successful
            if (response.data.status !== "1" || !response.data.result.length) {
                console.log(`No transactions found for address ${currentAddress} at level ${level}`);
                break;
            }

            // Get the first transaction that sent ETH to this address
            const firstFundingTx = response.data.result.find((tx: EtherscanTx) =>
                tx.to.toLowerCase() === currentAddress &&
                tx.isError === "0" &&
                BigInt(tx.value) > 0n
            );

            if (!firstFundingTx) {
                console.log(`No valid funding transaction found for ${currentAddress} at level ${level}`);
                break;
            }

            fundingChain.push({
                level,
                funderAddress: firstFundingTx.from as Address,
                fundingAddress: currentAddress as Address,
                amount: BigInt(firstFundingTx.value),
                txHash: firstFundingTx.hash as Address,
                timestamp: parseInt(firstFundingTx.timeStamp)
            });

            currentAddress = firstFundingTx.from.toLowerCase();

            await sleep(250);
        } catch (e) {
            console.error(`Error tracking funding at level ${level}:`, e);
            break;
        }
    }

    return fundingChain;
}

export async function saveFundingInfo(
    context: Context,
    poolId: string,
    fundingInfo: FundingInfo[],
): Promise<void> {
    const {db} = context;

    for (const funding of fundingInfo) {
        await db.insert(schema.fundings).values({
            poolId,
            level: funding.level,
            funderAddress: funding.funderAddress,
            fundingAddress: funding.fundingAddress,
            fundingAmount: funding.amount,
            fundingTxnHash: funding.txHash as Address,
        });
    }
}

export async function getPoolCreator(
    context: Context,
    poolId: string,
): Promise<Address | null> {
    try {
        const pool = await context.db.find(schema.pools, {
            id: poolId
        })
        return pool?.deployerAddress as Address || null;
    } catch (e) {
        console.error(`Error getting pool creator from poolId ${poolId}:`, e);
        return null;
    }
}

export async function processPoolFunding(
    context: Context,
    poolLiquidityProviderAddress: Address,
    poolAddress: Address,
    poolId: string
): Promise<void> {
    const tokenFundingChain = await trackFundingHistory(
        poolLiquidityProviderAddress,
        3
    );

    if (tokenFundingChain.length > 0) {
        await saveFundingInfo(context, poolId, tokenFundingChain);
        console.log(`Saved ${tokenFundingChain.length} token funding levels for ${poolLiquidityProviderAddress}`);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}