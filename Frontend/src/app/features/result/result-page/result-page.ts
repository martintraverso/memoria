import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-result-page',
  imports: [RouterLink],
  templateUrl: './result-page.html',
  styleUrl: './result-page.scss',
})
export class ResultPage implements OnInit {
  roomCode = '';
  winner = '';

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.roomCode = params.get('room')?.trim().toUpperCase() ?? '';
    this.winner = params.get('winner')?.trim() ?? '';
  }

  get outcomeTitle(): string {
    return this.winner ? `Ganó ${this.winner}` : 'Empate';
  }

  get outcomeEmoji(): string {
    return this.winner ? '🏆' : '🤝';
  }
}
