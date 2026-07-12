import { Routes } from '@angular/router';
import { GamePage } from './features/game/game-page/game-page';
import { HomePage } from './features/home/home-page/home-page';
import { LobbyPage } from './features/lobby/lobby-page/lobby-page';
import { ResultPage } from './features/result/result-page/result-page';

export const routes: Routes = [
  { path: '', component: HomePage, pathMatch: 'full' },
  { path: 'lobby', component: LobbyPage },
  { path: 'game', component: GamePage },
  { path: 'result', component: ResultPage },
  { path: '**', redirectTo: '' },
];
