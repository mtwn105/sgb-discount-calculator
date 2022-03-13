import { GoogleAnalyticsService } from './services/google-analytics.service';
import { SgbService } from './services/sgb.service';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router } from '@angular/router';
declare let gtag: Function;
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {

  data: any;
  filterText = "";

  dataSource = new MatTableDataSource();
  displayColumns = ["symbol", "issuePrice", "maturityDate", "yearsToMaturity", "interestPayable", "presentValueDividend", "fairValue", "askPrice", "tradedVolumeValue", "discount", "discountCmp", "yield"]

  @ViewChild(MatPaginator) paginator: MatPaginator;

  @ViewChild(MatSort) sort: MatSort;
  isMobile: boolean;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.loadScript();
  }

  constructor(
    private sgbService: SgbService,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    public googleAnalyticsService: GoogleAnalyticsService,
    private cDRef: ChangeDetectorRef
  ) {

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        gtag('config', 'G-W6WBWZ85BG',
          {
            'page_path': event.urlAfterRedirects
          }
        );
      }
    });
    breakpointObserver.observe(['(max-width: 768px)']).subscribe(result => {
      this.isMobile = !!result.matches;
    });
  }
  ngOnInit() {
    this.sgbService.getSgbData().subscribe((data: any) => {
      this.data = data;
      console.log(this.data)

      this.dataSource = new MatTableDataSource(this.data.data);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      this.googleAnalyticsService.eventEmitter("dataLoaded", "data", "");

    })
  }

  filter(event: any) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  toggleLiquidity(event: any) {
    if (event.checked) {

      const liquidSgb = this.data.data.filter((sgb: any) => sgb.tradedVolumeValue > 10);

      this.dataSource = new MatTableDataSource(liquidSgb);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.dataSource.filter = this.filterText.trim().toLowerCase();
    } else {
      this.dataSource = new MatTableDataSource(this.data.data);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.dataSource.filter = this.filterText.trim().toLowerCase();
    }
  }

  downloadCsv() {
    this.sgbService.getSgbDataCsv().subscribe((data: any) => {

      // File name will be sgb_YYYY-MM-DD.csv
      const fileName = `sgb_${new Date().toISOString().split('T')[0]}.csv`;

      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
    })
  }

  public loadScript() {
    this.cDRef.detectChanges();
    console.log('preparing to load...')
    let form = document.createElement('form');
    let node = document.createElement('script');
    node.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    node.setAttribute('data-payment_button_id', "pl_J64Ru9LDwkeZDD");
    node.async = true;
    form.appendChild(node);

    document.getElementsByClassName('payment')[0].appendChild(form);

  }

}
