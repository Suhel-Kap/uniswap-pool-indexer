import {type Context} from "ponder:registry"
import {Address, Transaction} from "viem";

export const filterTransactionsForAddress = async (context: Context, address: Address, eventData: {
    blockNumber: bigint;
    transactionIndex: number;
}): Promise<Array<Transaction>> => {
    const block = await context.client.getBlock({
        blockNumber: eventData.blockNumber,
        includeTransactions: true
    });

    if (!block || !block.transactions) return [];

    return block.transactions.filter((tx: Transaction) => {
        return tx.to?.toLowerCase() === address.toLowerCase() &&
            tx.transactionIndex !== null &&
            tx.transactionIndex > eventData.transactionIndex;
    }).sort((a, b) => {
        return (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0);
    });
}