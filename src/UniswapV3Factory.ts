import { ponder } from "ponder:registry";

ponder.on("UniswapV3Factory:FeeAmountEnabled", async ({ event, context }) => {
  console.log(event.args);
});

ponder.on("UniswapV3Factory:OwnerChanged", async ({ event, context }) => {
  console.log(event.args);
});

ponder.on("UniswapV3Factory:PoolCreated", async ({ event, context }) => {
  console.log(event.args);
});
