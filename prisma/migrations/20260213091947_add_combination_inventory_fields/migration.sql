/*
  Warnings:

  - You are about to drop the column `quantity` on the `CombinationInventoryLevel` table. All the data in the column will be lost.
  - You are about to drop the column `stockLocationId` on the `CombinationInventoryLevel` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[itemId,locationId,combinationKey]` on the table `CombinationInventoryLevel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `itemId` to the `CombinationInventoryLevel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationId` to the `CombinationInventoryLevel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `optionValueIds` to the `CombinationInventoryLevel` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[CombinationInventoryLevel] DROP CONSTRAINT [CombinationInventoryLevel_stockLocationId_fkey];

-- DropIndex
ALTER TABLE [dbo].[CombinationInventoryLevel] DROP CONSTRAINT [CombinationInventoryLevel_combinationKey_stockLocationId_key];

-- AlterTable
ALTER TABLE [dbo].[CombinationInventoryLevel] DROP CONSTRAINT [CombinationInventoryLevel_quantity_df];
ALTER TABLE [dbo].[CombinationInventoryLevel] DROP COLUMN [quantity],
[stockLocationId];
ALTER TABLE [dbo].[CombinationInventoryLevel] ADD [createdAt] DATETIME2 NOT NULL CONSTRAINT [CombinationInventoryLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
[itemId] NVARCHAR(1000) NOT NULL,
[locationId] NVARCHAR(1000) NOT NULL,
[lowStockThreshold] INT,
[optionValueIds] NVARCHAR(max) NOT NULL,
[quantityAvailable] INT NOT NULL CONSTRAINT [CombinationInventoryLevel_quantityAvailable_df] DEFAULT 0,
[reservedQuantity] INT NOT NULL CONSTRAINT [CombinationInventoryLevel_reservedQuantity_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [CombinationInventoryLevel_itemId_idx] ON [dbo].[CombinationInventoryLevel]([itemId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CombinationInventoryLevel_locationId_idx] ON [dbo].[CombinationInventoryLevel]([locationId]);

-- CreateIndex
ALTER TABLE [dbo].[CombinationInventoryLevel] ADD CONSTRAINT [CombinationInventoryLevel_itemId_locationId_combinationKey_key] UNIQUE NONCLUSTERED ([itemId], [locationId], [combinationKey]);

-- AddForeignKey
ALTER TABLE [dbo].[CombinationInventoryLevel] ADD CONSTRAINT [CombinationInventoryLevel_itemId_fkey] FOREIGN KEY ([itemId]) REFERENCES [dbo].[Item]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CombinationInventoryLevel] ADD CONSTRAINT [CombinationInventoryLevel_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[StockLocation]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
