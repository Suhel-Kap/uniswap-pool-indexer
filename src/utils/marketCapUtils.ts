import {Context} from "ponder:registry";
import schema from "ponder:schema";
import {CalculateMarketCapInput, GetMarketCapInput} from "./types";
import {min} from "ponder";

export function calculateMarketCap(data: CalculateMarketCapInput): bigint {
    const maxDecimals = Math.max(data.lpTokenDecimals, data.tokenDecimals);
    const minDecimals = Math.min(data.lpTokenDecimals, data.tokenDecimals);

    const PRECISION = 10n ** BigInt(maxDecimals);

    const priceOfOneTokenInLp: bigint = (data.lpTokenAmount * PRECISION) / data.tokenAmount;

    const decimalAdjustment = 10n ** BigInt(maxDecimals - minDecimals);
    const adjustedPrice = priceOfOneTokenInLp / decimalAdjustment;

    return (adjustedPrice * data.tokenTotalSupply * decimalAdjustment) / PRECISION;
}

export async function saveMarketCap(
    context: Context,
    poolId: string,
    tokenData: GetMarketCapInput
): Promise<void> {
    const {db} = context;

    await db.insert(schema.marketCaps).values({
        poolId: poolId,
        marketCap: tokenData.marketCap,
        token: tokenData.lpTokenAddress,
        tokenSymbol: tokenData.lpTokenSymbol,
    });
}