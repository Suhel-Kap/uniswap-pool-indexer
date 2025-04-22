import {onchainEnum, onchainTable, relations} from "ponder";
import {randomUUID} from "node:crypto";

export const newContractsDeployed = onchainTable("new_contracts_deployed", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    contractAddress: t.hex("contract_address").notNull(),
    creationBlock: t.bigint("creation_block").notNull(),
    creationTxnHash: t.hex("creation_txn_hash").notNull(),
    deployerAddress: t.hex("deployer_address").notNull(),
}));

export const tokens = onchainTable("tokens", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    name: t.text().notNull(),
    ticker: t.text().notNull(),
    decimals: t.integer().notNull(),
    contractAddress: t.hex("contract_address").notNull(),
    creationBlock: t.bigint("creation_block").notNull().default(-1n),
    creationTxnHash: t.hex("creation_txn_hash"),
    deployerAddress: t.hex("deployer_address"),
}));

export const lpType = onchainEnum("lp_type", ["UNISWAP_V2", "UNISWAP_V3"]);

export const pools = onchainTable("pools", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    tokenId: t.text("token_id").notNull(),
    pairedWithAddress: t.hex("paired_with_address").notNull(), // WETH/USDC/USDT address
    pairedWithSymbol: t.text("paired_with_symbol").notNull(), // "WETH", "USDC", "USDT"
    poolAddress: t.hex("pool_address").notNull(),
    tokenIsToken0: t.boolean("token_is_token0").notNull(), // Based on Uniswap's sorting
    creationBlock: t.bigint("creation_block").notNull().default(-1n),
    launchTimestamp: t.bigint("launch_timestamp").notNull(),
    creationTxnHash: t.hex("creation_txn_hash").notNull(),
    creationTxnIndex: t.integer("creation_txn_index").notNull(),
    lpType: lpType("lp_type").notNull(),
    initialLiquidity: t.bigint("initial_liquidity").notNull(),
    teamBundle: t.boolean().notNull().default(false),
    deployerAddress: t.hex("deployer_address").notNull(),
}));

export const poolsTokensRelations = relations(pools, ({one}) => ({
    token: one(tokens, {
        fields: [pools.tokenId],
        references: [tokens.id],
    }),
}))

export const snipers = onchainTable("snipers", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    poolId: t.text("pool_id").notNull(), // foreign key to pools table
    address: t.hex().notNull(),
    volumeBought: t.bigint("volume_bought").notNull(),
    percentSupply: t.doublePrecision("percent_supply").notNull(),
}));

export const snipersPoolsRelations = relations(snipers, ({one}) => ({
    pool: one(pools, {
        fields: [snipers.poolId],
        references: [pools.id],
    }),
}));

export const marketCaps = onchainTable("market_caps", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    poolId: t.text("pool_id").notNull(), // foreign key to pools table
    marketCap: t.bigint("market_cap").notNull(),
    token: t.hex("token").notNull(), // token address
    tokenSymbol: t.text("token_symbol").notNull(), // token symbol
}));

export const marketCapsPoolsRelations = relations(marketCaps, ({one}) => ({
    pool: one(pools, {
        fields: [marketCaps.poolId],
        references: [pools.id],
    }),
}));

export const fundings = onchainTable("fundings", (t) => ({
    id: t.text().primaryKey().$defaultFn(() => randomUUID()),
    poolId: t.text("pool_id").notNull(), // foreign key to pools table
    level: t.integer().notNull(),
    funderAddress: t.hex("funder_address").notNull(),
    fundingAddress: t.hex("funding_address").notNull(),
    fundingAmount: t.bigint("funding_amount").notNull(),
    fundingTxnHash: t.hex("funding_txn_hash").notNull(),
}));

export const fundingsPoolsRelations = relations(fundings, ({one}) => ({
    pool: one(pools, {
        fields: [fundings.poolId],
        references: [pools.id],
    }),
}));