import { createConfig } from "ponder";
import { http } from "viem";

import { UniswapV3FactoryAbi } from "./abis/UniswapV3FactoryAbi";

export default createConfig({
  networks: {
    mainnet: { chainId: 1, transport: http(process.env.PONDER_RPC_URL_1) },
  },
  contracts: {
    UniswapV3Factory: {
      abi: UniswapV3FactoryAbi,
      address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      network: "mainnet",
      startBlock: 12369621,
    },
  },
});
