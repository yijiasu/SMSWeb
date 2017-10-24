<template>
<div>
    <v-layout column>
    <v-flex>
        <v-list two-line class="pt-0">
          <template v-for="item in items">
            <v-list-tile avatar v-bind:key="item.sender" @click.stop="onMessageSelected(item)">
              <v-list-tile-avatar>
                <v-icon>message</v-icon>
              </v-list-tile-avatar>
              <v-list-tile-content>
                <v-list-tile-title v-html="item.sender"></v-list-tile-title>
                <v-list-tile-sub-title v-html="item.text"></v-list-tile-sub-title>
              </v-list-tile-content>
            </v-list-tile>
          </template>
        </v-list>
    </v-flex>
  </v-layout>

  <v-dialog v-model="is_show_dialog" fullscreen transition="dialog-bottom-transition">
    <v-card v-if="select_message">
      <v-toolbar style="flex: 0 0 auto;" dark class="primary">
          <v-btn icon @click.native="is_show_dialog = false" dark>
            <v-icon>close</v-icon>
          </v-btn>
          <v-toolbar-title>View Message</v-toolbar-title>
      </v-toolbar>

      <v-card-text>
        <v-list>
            <v-layout wrap>

              <v-flex xs4>
                <v-subheader>Sender</v-subheader>
              </v-flex>
              <v-flex xs8>
                <v-subheader v-html="select_message.sender"></v-subheader>
              </v-flex>

              <v-flex xs4>
                <v-subheader>Recv Time</v-subheader>
              </v-flex>
              <v-flex xs8>
                <v-subheader v-html="select_message.time"></v-subheader>
              </v-flex>

              <v-flex xs12>
                <v-divider></v-divider>
                <v-subheader class="grey--text text--darken-4" v-html="select_message.text"></v-subheader>
              </v-flex>
            </v-layout>

        </v-list>
      </v-card-text>

    </v-card>
  </v-dialog>

</div>
</template>

<script>

//  { divider: true, inset: true },

import axios from 'axios'
import _ from 'lodash'

export default {
  mounted() {
    axios.get(`/public/recv_sms.json`)
    .then(response => {
      console.log(response.data)
      this.items = response.data
    })
  },

  data () {
    return {
      is_show_dialog: false,
      select_message: null,
      items: []
      }
  },

  methods: {
    onMessageSelected: function (item){
      this.is_show_dialog = true
      this.select_message = item
    }
  }
}
</script>
