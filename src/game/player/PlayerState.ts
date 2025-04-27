export class PlayerState {
  public walnutsToHide: number = 3;

  decrementWalnutsToHide() {
    if (this.walnutsToHide > 0) {
      this.walnutsToHide--;
    }
  }

  hasWalnutsToHide(): boolean {
    return this.walnutsToHide > 0;
  }
} 