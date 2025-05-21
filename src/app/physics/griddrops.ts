import { Player } from "../pnj/player/player";

export class GridDrops {
  
  constructor(
    private player: Player,
    public mainScene: Phaser.Scene,

  ) {
    this.mainScene.events.on('enemyDied', (position: Phaser.Math.Vector2) => {
      this.dropItem(position);
    });
  }

    dropItem(position: Phaser.Math.Vector2) {
      console.log('dropitem');
      
      const offsetX = Phaser.Math.Between(200, 200); // Desplazamiento aleatorio en X
      const offsetY = Phaser.Math.Between(-20, 20); // Desplazamiento aleatorio en Y
      const droppedItem = this.mainScene.physics.add.image(
          position.x + offsetX,
          position.y + offsetY,
          'sword'
      );
      droppedItem.setScale(3);
      droppedItem.setOrigin(0.5, 0.5);
      
      this.mainScene.physics.add.overlap(
        this.player.getSprite(), // Sprite del jugador
        droppedItem, // Objeto dropeado
        () => {
            this.onItemCollected(droppedItem); // Llamar a la función cuando el jugador pase por encima
        }
    );

      // Añadir overlap entre el jugador y el objeto
 

      console.log("Item dropped at", droppedItem.x, droppedItem.y);

    
  }
  private onItemCollected(item: Phaser.GameObjects.Image) {
    console.log("Item collected!");
    item.destroy(); // Destruir el objeto
    this.mainScene.events.emit('itemCollected', item); // Emitir un evento si es necesario
}
}