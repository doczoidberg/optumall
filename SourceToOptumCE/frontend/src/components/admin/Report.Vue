<template>
  <!-- Page Content -->
  <div id="page-wrapper" class="users-page">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h1 class="page-header">Reporting</h1>
        </div>
        <!-- /.col-lg-12 -->
      </div>
      <!-- end title -->
      <div class="col-xs-12 col-lg-12 sort-left no-padd-left">
        <h4>Report Period</h4>
      </div>
      <div class="col-xs-12 col-lg-9 sort-left no-padd-left">
        <div class="form-group">
          <div class="mcontainer">
            <label for="">Start:</label>
            <Vue2DatePicker
              v-model="start_time"
              valueType="format"
              format="DD.MM.YYYY"
              placeholder="Start"
            ></Vue2DatePicker>
          </div>
        </div>
        <div class="form-group">
          <div class="mcontainer">
            <label for="">End:</label>
            <Vue2DatePicker
              v-model="end_time"
              valueType="format"
              format="DD.MM.YYYY"
              placeholder="End"
            ></Vue2DatePicker>
          </div>
        </div>
        <div class="form-group">
          <div class="mcontainer">
            <button type="button" @click="doFilter()">Apply</button>
          </div>
        </div>
        <div class="form-group" v-if="showLoading">
          <div class="mcontainer loading-indicator">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
              <radialGradient
                id="a10"
                cx=".66"
                fx=".66"
                cy=".3125"
                fy=".3125"
                gradientTransform="scale(1.5)"
              >
                <stop offset="0" stop-color="#180785"></stop>
                <stop offset=".3" stop-color="#180785" stop-opacity=".9"></stop>
                <stop offset=".6" stop-color="#180785" stop-opacity=".6"></stop>
                <stop offset=".8" stop-color="#180785" stop-opacity=".3"></stop>
                <stop offset="1" stop-color="#180785" stop-opacity="0"></stop>
              </radialGradient>
              <circle
                transform-origin="center"
                fill="none"
                stroke="url(#a10)"
                stroke-width="21"
                stroke-linecap="round"
                stroke-dasharray="200 1000"
                stroke-dashoffset="0"
                cx="100"
                cy="100"
                r="70"
              >
                <animateTransform
                  type="rotate"
                  attributeName="transform"
                  calcMode="spline"
                  dur="1"
                  values="360;0"
                  keyTimes="0;1"
                  keySplines="0 0 1 1"
                  repeatCount="indefinite"
                ></animateTransform>
              </circle>
              <circle
                transform-origin="center"
                fill="none"
                opacity=".2"
                stroke="#180785"
                stroke-width="21"
                stroke-linecap="round"
                cx="100"
                cy="100"
                r="70"
              ></circle>
            </svg>
          </div>
        </div>
      </div>

      <div class="col-xs-12 col-lg-3 sort-right no-padd-left">
        <div class="clearfix">
          <div class="float-right">
            <b-dropdown text="Export to Excel" class="m-md-2" variant="primary">
              <b-dropdown-item @click="exportExcel(true)">To *.xlsx</b-dropdown-item>
              <b-dropdown-item @click="exportExcel(false)">To *.csv</b-dropdown-item>
            </b-dropdown>
          </div>
        </div>
      </div>

      <table class="table table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>GX Usage</th>
            <th>G2 Usage</th>
            <th>G3 Usage</th>
            <th>CS Usage</th>
          </tr>
          <tr class="table-subtitle">
            <th>(-)</th>
            <th>(-)</th>
            <th>(hours)</th>
            <th>(hours)</th>
            <th>(hours)</th>
            <th>(hours)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in items">
            <td>{{ i.name }}</td>
            <td>{{ i.email }}</td>
            <td>{{ i.gx }}</td>
            <td>{{ i.g2 }}</td>
            <td>{{ i.g3 }}</td>
            <td>{{ i.cs }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- /.container-fluid -->
  </div>
</template>

<script>
import { authHeader, configHeaders, responseStatus } from "@/_helpers";
// import Datepicker from "vuejs-datepicker/dist/vuejs-datepicker.esm.js";
import { mapState, mapActions } from "vuex";
// import XDatePicker from "../XDatePicker";
import Vue2DatePicker from "vue2-datepicker";
import "vue2-datepicker/index.css";
import moment from "moment";

/* eslint-disable */
export default {
  name: "Report",
  components: {
    // Datepicker,
    // XDatePicker,
    Vue2DatePicker,
  },
  data() {
    return {
      items: [],
      start_time: moment().startOf("month").format("DD.MM.YYYY"),
      end_time: moment().format("DD.MM.YYYY"),
      showLoading: false,
      start_time_data: null,
      end_time_data: null,
    };
  },
  methods: {
    json_date(t) {
      return t ? moment(t, "DD.MM.YYYY").format("YYYY-MM-DD") : null;
    },
    fetch() {
      let uid = this.account.user.id;
      if (!uid) uid = this.account.user.user.id;
      let req = `${process.env.STATS_ENDPOINT}/usage?user_id=${uid}`;
      if (this.json_date(this.start_time))
        req += `&start_time=${this.json_date(this.start_time)}`;
      if (this.json_date(this.end_time))
        req += `&end_time=${this.json_date(this.end_time)}`;
      this.showLoading = true;
      this.$http
        .get(req, configHeaders())
        .then((response) => {
          if (response.data == "") this.items = [];
          else this.items = response.data;
        })
        .catch((error) => {
          responseStatus(error);
        })
        .finally(() => {
          this.showLoading = false;
          this.start_time_data = this.start_time;
          this.end_time_data = this.end_time;
        });
    },
    doFilter() {
      this.fetch();
    },
    exportExcel(toxlsx) {
      let req = `${process.env.STATS_ENDPOINT}/usage/export-excel`;
      let headers = configHeaders();
      headers.responseType = "blob";
      this.$http
        .post(
          req,
          {
            items: this.items,
            start_time: this.json_date(this.start_time_data),
            end_time: this.json_date(this.end_time_data),
            to_xlsx: toxlsx,
          },
          headers
        )
        .then((response) => {
          const blob = new Blob([response.data]);
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = toxlsx ? "license_usage.xlsx" : "license_usage.csv";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href); // Clean up the URL object
          console.log("export excel complete");
        })
        .catch((error) => {
          responseStatus(error);
        })
        .finally(() => {
          this.showLoading = false;
        });
    },
  },
  mounted() {
    this.fetch();
  },
  computed: {
    ...mapState({
      account: (state) => state.account,
    }),
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.table-subtitle {
  th {
    font-size: 0.8em;
    font-weight: normal;
  }
}
.mcontainer {
  margin: 3px;
}
.no-padd-left {
  padding-left: 0 !important;
}
.loading-indicator svg {
  width: 30px;
}
</style>
<style>
.mx-input {
  height: 26px !important;
}
.mx-datepicker {
  width: 150px !important;
}
</style>
