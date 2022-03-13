import { environment } from './../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SgbService {

  constructor(
    private http: HttpClient
  ) { }

  // Get SGB data
  getSgbData() {
    return this.http.get(environment.apiUrl + '/sgbs');
  }

  // Get SGB data in csv format
  getSgbDataCsv() {
    return this.http.get(environment.apiUrl + '/sgbs/csv', { responseType: 'text' });
  }

}
